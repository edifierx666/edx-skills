# 统一 worker 生命周期与证据契约

总指挥将本文件全文放入 XML spec 的 `<lifecycle_contract>`（需求审计官另在 `<audit_spec>` 附原文审计规范），结构见 coordinator-protocol「Worker spec XML 结构」；worker 不依赖相对路径可读性。

- 只用当前 Orca preamble 的可执行文件、handle、Task ID、Dispatch ID。自然检查点及完成前检查追加指示。`check` 返回 `consumer_fenced` 立即停止，不重试 check、不发送完成事件；send/ask 的同名错误先停止副作用并按 worker-contract 核实调用终端身份，禁止沿用过期身份。
- `worker_done` 是一次逻辑完成事件；完成报告发送后停止 check、轮询和新工作。响应丢失不盲目重复发送：由 coordinator 先 request-show，再核对 Task/Dispatch；只有当前 recovery guide 允许时才用相同 request ID、相同命令精确恢复。没有 request 身份或结果不唯一就停止并升级，不能新建完成事件猜测补发。
- 工具调用失败不等于 Orca Task/Dispatch 终态，也不自动证明 child 完成或失败。父 worker 必须把失败记录为内部执行事件，区分调用未启动、命令已执行但非零、错误后有可核验后续结果和错误后没有最终结果；继续执行不等于重试失败调用。
- 每个工具错误事件至少记录工具/命令、cwd、时间、错误或 exit code、是否可能产生副作用、是否重试、恢复结果和未执行项。只有确认没有副作用且工具契约允许时才能有限重试；结果可能已产生副作用但状态不确定时先对账或停止依赖该结果，禁止盲目重试、静默换模型/Agent 或并行重复执行。
- 父 worker 必须逐项登记每个必需和可选 child 的状态、结果、错误与证据。内部 child 的本地状态使用 `not_started | running | completed | failed | blocked | unknown`，不把它冒充成 Orca API 枚举；`completed` 只表示有可核验最终结果，不表示发现或质量门通过。
- 必需 child 未完成、失败、阻塞、状态未知、报告缺失或证据不足时，父 worker 不得用 `worker_done --outcome succeeded` 表示整体任务已完成；无法恢复时用 `failed` 或 escalation 报告已完成部分、遗留项和所需动作。部分结果不得包装为整体 PASS、SHIP 或完成。
- `--outcome succeeded` 仅表示角色任务完成并提交可读报告，不等于质量 PASS。测试员测试执行完成但产品测试失败，可以 succeeded，但 verification_status 必须 failed；审查员只有 SHIP 才过审。没有完成任务用 failed。execution_status、verification_status、review_verdict、fact_status 由 coordinator 账本分开记录，不是虚构的 Orca API 字段。
- 报告包含 Run/Task/Dispatch、stage/revision、spec 和输入/输出 hash、实际命令、cwd、时间、exit code、关键输出/证据路径、未执行项与原因；effective model 以 coordinator 的 launch.effective 回执为准。摘要不替代真实执行证据，凭证与敏感值必须脱敏。
- `--report-path` 必须指向实际存在的报告文件，不能填目录。只读角色只可写 spec 明确独占的 report-file Ownership；artifact/render/测试输出目录另列并授权。未经授权不运行会写入其他路径的检查，不清理别人改动以伪造干净状态。
- 参与 reviewer、fact-checker、editor 或 red-team 时，spec 必须提供该输入范围的 authorFamilies（所有实际内容作者已核实 effective family 的并集，含测试、编辑、修复及整合作者）。前三者排除整个 authorFamilies，红方另排除相关 reviewer family 集合；集合缺失、家族未知或自身命中禁用集合时先 ask 并停止该阶段，不能自动拆审冒充整体终审。
- 所有模式包括 worktree 均默认不 commit、不执行 git 写操作、不越界。worktree 与提示词不是权限沙箱；数据/provider policy 未确认、权限控制未核实或出现基线重叠时停止并 ask。不得自行更改权限设置。修复后旧验收证据失效，等待新 revision。

## Coordinator 用户可见汇报契约

这是 coordinator 的本地报告格式，不是 Orca API 状态；适用于 `complete`、`partial`、`incomplete`、`unknown`、`escalation` 全部结论。报告按任务复杂度展开或合并以下五个锚点：

1. **交付结论与把握度**：写本地整体状态、核心产出、已核实事项、假设、待确认项和判定理由。把握度使用“高把握”“存在部分推测”或“信息源受限仅作参考”；不得把推测包装成确定事实。
2. **执行轨迹与行动足迹**：写计划任务总数与状态计数；每个 Task/Dispatch/attempt 的 Orca 原始状态及查询/回执依据；派发的角色、修改的文件/产物和实际执行的命令。未执行事项必须写“未执行”。
3. **可抽检凭证**：写报告绝对路径与 hash、输入/输出 hash、关键命令、cwd、时间、exit code、关键输出/证据路径和 `launch.effective`。调研/分析类补原始出处、关键摘录或链接；内容类说明约束对齐；操作类给 diff/真实返回。摘要不替代原始证据，敏感值必须脱敏。
4. **核心取舍与隐式假设**：暴露模糊指令下的默认标准、模型/并发/范围假设，记录工具失败、死胡同、转向和 fallback 及其覆盖影响。
5. **盲区与待确认项**：列未验证、无法确认、证据缺口、超出范围的事项、潜在风险、下一步和需要用户拍板的动作。

`complete` 仅在所有必需 child 有可核验最终结果、关联 Orca 状态已对账且证据齐全时成立；不完整结论仍须首行写“未形成可信的整体完成结论”。`worker_done`、工具错误和 projection 不能替代 Orca 状态或原始凭证。
