# Coordinator Protocol

本文件定义协调器的本地记录和验收纪律。Orca 的 Task、Dispatch、Delivery 和终端回执仍是生命周期权威；本地账本只记录协调器意图、证据和决策，不替代 Orca 状态，也不提供与 Orca mutation 的原子事务或 exactly-once 保证。

## Run Manifest 与基线

每个 Run 建立一个仅由 coordinator 写入的 manifest，建议放在 `.orca-notes/runs/<run-id>/manifest.md`。worker 的 Ownership 不得包含此目录。manifest 只存必要元数据，不复制凭证、敏感正文或完整私有数据。

启动前记录：

- repo/workspace、HEAD 与基线 ref/SHA；无 Git 文件夹则记录目标目录及文件清单。
- `git status --porcelain=v1 -uall`、暂存与未暂存 tracked diff、未跟踪路径及其内容 hash。对计划修改的路径记录基线 hash。
- 每个 Task 的角色、spec 版本/hash、唯一 Ownership、依赖、测试/审查输入版本。
- 数据分类、获准 provider/family、外网策略、脱敏/保留要求；不确定即暂停，不得猜测组织策略。网页访问 worker 使用无密钥文件的隔离 worktree；不能保证则只给脱敏资料或暂停派发。
- 并发、启动尝试、重试、修复轮次及用户在计划中确认的 Run dispatch ceiling（估算说明和数值）。

若 dirty/untracked 基线与计划 Ownership 重叠，不能可靠区分本次任务和用户已有改动。停止涉及路径的写入，请用户明确处理方式；不得自动 restore、reset、stash、clean 或覆盖。worktree 也不是权限沙箱。

## Worker spec XML 结构

发给 worker 的 spec 必须是单个 XML 文档，根元素为 `<worker_spec>`，用标签分隔指令与数据，避免 worker 把附件或被审内容当成指令：

```xml
<worker_spec run="{{run_id}}" task="{{task_id}}" revision="{{revision}}">
  <role_prompt role="{{路由键}}">替换占位符后的角色前置提示词</role_prompt>
  <scope>Ownership、被审范围、冻结输入 manifest/hash、authorFamilies</scope>
  <acceptance>验收命令或检查清单、独占报告路径</acceptance>
  <lifecycle_contract><![CDATA[references/worker-lifecycle.md 全文]]></lifecycle_contract>
  <concurrency_profile><![CDATA[所选并发 Profile 全文]]></concurrency_profile>
</worker_spec>
```

角色模板中的 `{{...}}` 占位符必须全部替换；派发前用 `xmllint --noout` 或等效解析器校验整份 spec，解析失败或残留占位符时不得派发。原文附件（worker-lifecycle、并发 Profile、需求审计规范、需求文档摘录、diff 等）放入 CDATA；附件含 `]]>` 时拆分为相邻 CDATA 段，不得改写正文。XML 标签只是结构约定，不是权限沙箱，也不新增 Orca API 字段。

## 三种并发 Profile

- `shared-serial`：默认。共享目录同时最多一个写入 worker；实现完成后先冻结产品内容，仅 tester 串行写测试并运行，tester 完成后冻结完整候选再审查。测试和构建若会产生文件，必须指定独立输出目录，或在冻结产品内容后串行执行。
- `parallel-doc`：仅限普通文档工作区，不要求是 Git 仓库。派发前记录目标目录、完整文件清单及每个现存文件的 hash；每个 writer 只写唯一且互不重叠的章节文件路径，Ownership 不得使用含糊的目录级通配，也不得共写一个物理文件、临时文件或输出路径。Run manifest/spec 等 coordinator 控制文件应放在目标文档目录之外；若做不到，须在基线中单独标记为 coordinator-owned，排除出所有 writer Ownership 并单独核验。章节需落入同一文件时，writer 先写各自隔离的章节副本/补丁，由 coordinator 串行组装。所有 writer 完成后，coordinator 按清单与 Ownership 汇总到唯一候选，逐项核对原有文件 hash、新增路径及意外文件，冻结后再运行适用的事实核查、终审和交付验收。若基线不清、章节路径交叠或同目录写入无法明确归属，先补齐基线并拆分隔离路径，否则改用 `shared-serial`。非 Git 工作区没有版本控制 diff；文件清单/hash 只能辅助归因，不证明内容正确或 worker 未越权。
- `parallel-worktree`：仅用户明确授权隔离 worktree 后使用。锁定共同基线 SHA，每个并行实现 writer 使用独立 child worktree。实现完成后由 coordinator 按 manifest 组装全部被测成果到唯一候选 worktree，核对基线、冲突与输入 hash；候选组装不要求测试通过。tester 进入该现有候选 worktree 独占测试文件并写测/运行，不从共同基线另开空白 child。测试通过后冻结完整候选，再派最终独立 reviewer，随后交付。局部审查不替代最终跨文件集成审查；转移到其他目标目录后重新核对 hash 并验收。

默认最多 4 个活动 worker。高风险或不可逆任务（删除、生产配置、安全/合规、对外发布）要求隔离 worktree 且预先核实 Manual permissions 或等效实际控制；worktree、Ownership 和“只读”提示均不构成 OS 权限隔离。若用户明确要求在 current 执行，先说明具体风险并取得确认。网页访问 worker 必须使用独立干净 worktree，并确认工作区无密钥文件；否则 coordinator 提供脱敏资料或暂停派发。

## Ownership 与依赖

计划列全产品代码、测试、API/schema、迁移、生成物、配置、fixture、文档、渲染产物和报告路径。每条可写路径只有一个 owner；需要移交时明确串行依赖和交接版本。Coder 只负责产品路径，tester 独占测试路径：实现 settled 后 tester 写/更新测试并运行最终测试。只有接口/spec 已稳定且 Ownership 不重叠的 test-first 任务可提前执行，且其结果不替代集成后测试。

共享模式下所有写入者完成后再启动 reviewer，不能一边写一边审。整合后必须由独立 reviewer 审查完整最终 diff；任何修复都使对应测试、事实核查或审查证据失效，须重新执行。

## Delivery 去重与恢复

一个 coordinator 负责一个 Run。账本用 append-only 事件记下 Run、Delivery、message、Task、Dispatch、request ID、阶段与 revision、副作用意图/回执、模型 requested/resolved/effective、验收证据和资源去向。推荐事件键：`runId + deliveryId + messageId`；阶段验收键：`runId + taskId + stage + revision`。

处理一个 Delivery 时：

1. 持久化收到的 Delivery/message ID 和当前状态。
2. 对未处理消息先写入副作用 intent，再执行回复、派发、复用或释放等动作。
3. 收到回执后记录 Orca 返回的 ID、状态和 recovery action，并标记该消息已处理。
4. 只有该 Delivery 所有消息都处理完且状态可对账后才 ack；然后记录 ack 结果。

重放已处理 message 只核对状态，不重复执行原业务副作用。若 ack 已发但本地未记账，只查询 Orca 状态并补记，不重新派发。

mutation 响应丢失时先调用 `request-show`。`completed` 读取原回执；`pending` 仅使用同一 request ID 和完全相同的原命令 `--retry-request`；`absent` 不是未执行证明，必须查询影响的 Task、Dispatch 和终端。没有 request ID 时也只能通过 Orca 权威状态归因。无法唯一确认时暂停 ack、dispatch、retry、release 及其他写操作，保留证据并升级给用户；绝不创建新 request 猜测重做。Orca mutation 和本地账本之间不存在原子提交，不能承诺 exactly-once。

所有支持 `--run` 的 Task/worker/check/list 查询显式传当前 Run ID。run-create 仅建立 Run namespace/inbox，不负责创建或调度 worker。worker-start 必须另行执行，且显式指定 placement。

## Child 对账与整体状态

父 coordinator 在任何整体汇报、最终整合或质量门结论前，必须按 manifest 逐项核对每个必需 child、关联的 Task/Dispatch/attempt 和父 worker 报告；不能只统计收到的 `worker_done` 数量，也不能把父 worker 的一句摘要当作 child 完成证据。每一项至少保留内部 child 状态、Orca 原始回执/查询结果、报告或结果路径、输入/输出 hash、错误/恢复事件和最近可读证据。

面向用户汇总时，按 child 分别透传职责、关键动作/产物、worker 自报的自主偏离（含原因、影响和回退方式）、逻辑缺口（异常与逆向流缺失、原需求逻辑漏洞、上下游连锁断层）、完整性/mock/校验声明、临时产物清理状态、关键红线及信源性质；明确标出哪些由 coordinator 独立核验、哪些仅为 worker 自报或仍未知。无偏离/无残留的项在用户汇报中直接省略，但未核实项不得省略。清理声明不能替代 manifest/status 核查，也不得为得到“全清”而删除归属不明或用户/他人资源。

并行或串行交接时，coordinator 对照各 child 的产出与下游 spec，核验接口字段/格式、命名、版本/hash、核心假设和风格约束是否一致；记录冲突、受影响的下游和需用户裁决项。某个 child 报告的上下游连锁断层若落在另一个 child 或范围外模块，coordinator 负责在汇报中把两端对应起来。不得用各自局部通过推导整体契约一致；未对齐时暂停受影响的下游门或明确报告阻塞。

Orca 的 Task/Dispatch 状态始终以当前版本回执和查询为准，不在本协议中假设完整终态枚举。coordinator 可以做不冒充 Orca 字段的本地归类：`not_started | nonterminal | terminal_succeeded | terminal_failed | terminal_other | unknown`。内部 child 则单独使用 `not_started | running | completed | failed | blocked | unknown`；工具调用失败事件不替代任一层的状态查询。

整体执行状态只按以下本地语义汇报：全部必需 child 有可核验最终结果、每个关联 Orca 状态已对账且证据齐全时才可为 `complete`；有完成项和未完成/失败项为 `partial`；没有完成的必需项为 `incomplete`；任一必需项无法确认且影响结论为 `unknown`。若账本和 Orca 状态无法对齐，整体状态不得为 `complete`。

执行结案、质量门和资源结算是三条独立状态轴：`execution_status` 表示是否完成并提交产物；`verification_status`、`review_verdict`、`fact_status` 表示测试/审查/事实门；`worker-list` 的 `active`、`reclaimable`、`retained`、`release_pending`、`release_unknown`、`released` 只表示资源处置。`released` 不代表任务通过，`retained` 不代表 worker 完成，资源已结算也不代表质量门通过。

当状态为 `partial`、`incomplete` 或 `unknown` 时，用户可见汇报第一行必须写明“未形成可信的整体完成结论”，并至少包含：计划任务总数及各状态计数；每个 Task/Dispatch 的 ID、原始状态和查询/回执依据；每个内部 child 的状态、错误/恢复摘要、结果或缺失证据；`execution_status`、`verification_status`、`review_verdict`、`fact_status`；未完成项、原因和下一步。已完成 child 的结果可以单独展示，但不得写成整体 PASS、SHIP 或完成。

## 完成状态与质量门

`worker_done --outcome succeeded` 表示 worker 已完成其角色任务并提交报告，不等于交付质量通过。合法 worker_done 会自动结算 Orca Task；不要用 `task-update completed` 冒充验收。

Coordinator ledger 独立记录：

- `execution_status`：worker 是否完成并提交可读产物。
- `verification_status`：验收命令/清单是否通过及证据路径。
- `review_verdict`：`SHIP`、`FIX-FIRST` 或 `BLOCKED`。
- `fact_status`：`verified`、待修、已复核等事实处置。
- 输入版本、基线/产物 hash、命令、cwd、时间、exit code、必要输出和 `launch.effective`。敏感值必须脱敏。

代码只有在实现完成、最终测试退出码为 0、整合 reviewer 给 `SHIP` 后才能交付。Tester 即使发现产品 bug，也可用 succeeded 表示“测试任务完成”，但 `verification_status` 必须为 failed，阻断候选验收和交付；不阻断为测试而组装候选。失败后产品 owner 在候选内串行修复，升 revision 再交 tester 重跑。Reviewer succeeded 仅表示审查结束；只有 `SHIP` 解锁下一门，`FIX-FIRST` 必须修复重审，`BLOCKED` 阻断相关交付。

PPT worker 完成并冻结产物后，coordinator 必须再派 fact-checker 核对幻灯片文本、图表标签和数据；该报告是最终事实门之一。

文档的事实支持状态只由 fact-checker 报告建立。`wrong`、`unsupported`、`outdated` 或 `link-broken` 回到原 writer/事实 owner 修正或删除，再由 fact-checker 复核；editor 只做语言/结构编辑。Reviewer 与 fact-checker 冲突时，事实问题保持阻断，回到事实 owner 和 fact-checker 复核。Editor 修改后，如无法以 diff 证明事实字段、引用及论点均未变化，重新事实核查。最终文档 reviewer 只能对最终版本给 SHIP。

红方 critical/major 未解决或被驳回时，由用户或计划中明确指定的 risk owner 接受并记录依据；未接受的 major 也阻断交付。Coordinator 不得单方把风险改写成“已接受”。

每个 `gate × review scope` 的修复轮次分别计数，最多 2 轮；文档事实核查 wrong/unsupported/outdated/link-broken 的修复与复核也计入该事实 gate 的 2 轮上限。到达上限时停止并请用户处理，不扩大轮数或另建 scope 绕过。

## 模型与预算限制

从本地模型列表解析精确模型 ID；只允许 `references/model-catalog.md` 的已知 alias 与本次实时 `data[].id` 精确相交，或用户在本 Run 计划中确认的新 alias/family 映射。不使用模糊“最接近”匹配。对 author/reviewer/red-team（以及默认 fact-checker）的家族约束在选择默认、fallback、覆盖模型后都必须成立；启动回执 `launch.effective` 再核验一次。多作者范围使用 `authorFamilies`：所有实际修改该范围内容的作者已核实 effective family 的并集，含 tester、editor、修复及整合作者；原样转移不新增作者，coordinator 修改内容则也记录其 family。reviewer、fact-checker、editor 排除该范围整个集合；红方另排除相关 reviewer family 集合。家族未知或无合法候选时暂停，不能用自动拆审取代最终跨文件集成审查。无唯一合格映射时暂停并询问。

默认上限：最多 4 个活动 worker；`shared-serial` 最多 1 个写入者，满足所选并发 Profile 条件时最多 4 个并行 writer；每 Task 最多 3 次启动尝试（含首次）；对一个不确定 mutation 最多一次同 request ID 精确重放后再查证；每个 `gate × review scope` 最多 2 轮修复、最多 1 次能力升级。每 Run 的 worker-dispatch ceiling 在计划阶段逐关估算（含计划审查、测试、最终审查、红队和修复预留），与计划一起交用户确认；临近 ceiling 且剩余工作超额时暂停新派发并询问是否追加，不设统一固定的硬上限。保留路由表中各角色的 effort 默认值。若 provider 未提供可核验的 token/价格数据，只报告真实可观察的调用次数、时间和结果，不声称执行了美元硬预算。

## 收尾、提交与清理

以 `orca orchestration worker-list --run <run_id> --include-remote --limit <1-100> --json` 枚举资源；按返回的 `page.nextCursor` 原样继续，直到无下一页。逐项分类 `active`、`reclaimable`、`retained`、`release_pending`、`release_unknown`、`released`，检查 `projection.nextAction` 并按当前 recovery guide 处理。

**谁启动谁负责结算**：coordinator 对自己启动的 worker 负责盘点并处理资源结算。每个 settled Dispatch 都要选择复用、按用户要求保留，或按当前版本 `orchestration` 指南执行 `worker-release`；不复用且确认归当前 Dispatch 所有的终端，不得因默认含糊而长期搁置。`projection.nextAction` 是建议而非执行证明；只有 mutation 回执或后续权威查询确认后才能记为已释放。

保留资源必须逐项记录依据，例如预存、复用、setup、coordinator 自用、用户明确接管，或已证明不归本 Dispatch 所有；保留的终端不能汇报成已关闭。`release_pending` / `release_unknown` 必须沿当前 recovery guide 按回执对账恢复，绝不用 `terminal close` 替代。无法唯一确认时暂停相关 mutation 并升级给用户。保留现有边界：不为清空列表而强制关闭不归本 Dispatch 所有的资源。

执行、质量和资源状态分开汇报：`released` 不代表任务通过，`retained` 不代表 worker 未完成，worker 完成也不代表终端已释放。存在 `active`、`reclaimable` 或未解决的 release 状态时，不得声称资源已完全结算。

整合前运行 `git status --porcelain=v1 -uall`、检查 staged/unstaged diff，并逐项列出每个 untracked 文件及 hash。不能只用 `git diff --stat`，因为新文件不会出现在其中。对任何无关 `.orca-notes/` 内容不得 stage。无授权时默认不提交，保留未提交结果并汇报 ref/status。仅用户明确授权 commit 后，coordinator 才能对基线干净、归属明确的 manifest 路径执行 `git add -- <paths>`；任何基线 dirty/untracked 路径重叠或归属不明都阻断提交。shared 与 worktree 模式适用同一提交规则；最终记录 commit/ref，不能假定 fast-forward merge 一定产生 commit。

未提交 worktree 结果不能通过 merge 整合：按已核验 manifest 导出 patch/逐文件转移（含 untracked、删除、二进制及前后 hash），或请求用户授权 commit 后再合并已提交分支。转移前核对目标基线与冲突，整合后重新测试、事实核查及独立 reviewer 终审。

仅用户明确授权后删除 worktree/分支。删除前核对 Orca worktree 记录、Git worktree 列表与目标路径，确认不包含未交付改动。
