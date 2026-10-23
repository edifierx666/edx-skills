# 多智能体并发 Review（一句话极速启动）

本文件定义“用户只说一句话就要多个智能体 review”时的默认执行路径。它是本 Skill 触发后最常见的请求形态，优先级高于需要先出计划的写入型流水线；一旦判定为本模式，按本节直接派发。

## 触发信号

出现以下任一意图即进入本模式，不需要用户补齐额外字段：

- “review 一下代码”“看看代码写得怎么样”。
- “代码是否符合需求文档 / PRD / 交互文档”“对照需求核查”“验收一下”。
- “多个智能体 review”“多模型 review”“多 agent 交叉审查”。
- 用户 `@` 了一份需求/PRD/设计文档并要求 review 或核对。

判定为本模式后，coordinator 只需读需求文档与代码目录结构来完成**任务拆解和写 spec**，不再向用户索要计划确认。

## 默认法则：先派发，后补全

本模式是**只读**任务，默认遵循：

- 数据策略：被审对象是本机仓库或用户主动提供的文档，按本地只读处理；不需要用户先声明敏感度分级。若被审范围含生产配置、凭证、密钥文件或明确标注的敏感数据，才停下来确认。
- 派发额度：默认 Run dispatch ceiling 记为 6，不必先问用户。剩余工作预计超过剩余额度时，仍按 `references/recovery.md` 的额度规则停下询问。
- 计划确认：不需要用户先批准角色/模型/Ownership 计划；只读 review 计划与默认数据策略一致时直接创建 Run 并派发。
- 写入、并行写入、高影响操作不在本模式默认范围内；用户随后要求“顺手改掉”时，回到对应写入流水线并重新取得授权。

## 最少智能体数

- 至少 **2 个** worker，默认 **3 个**；全部为只读审查角色。
- 这些 worker 必须覆盖至少 **2 个不同开发者家族**（家族映射见 `references/model-catalog.md`）。
- 单个 reviewer 只能算 1 个智能体。coordinator 自己读代码、自己写结论不构成智能体，也不能替代其中任何一个。
- 只用 1 个 worker 就交付，或把审查结论拆成多段冒充多个智能体，都是不合规交付。

## 角色分工拓扑

默认 3 个并行只读 worker，各自独立写报告，互不依赖，可同时启动：

| worker | 建议模型 | 审查焦点 | 报告路径 |
| --- | --- | --- | --- |
| reviewer ×1 | `Claude Opus 5.5` 或候选链中其他家族 | **需求契约逐项对齐**：把需求文档的每个字段、上限、占位文案、校验规则、交互状态逐条对照代码实现，列出漏实现、文案不一致、校验缺失、边界值不符 | `.orca-notes/runs/<run_id>/reports/review-contract-<family>.md` |
| reviewer ×1 | 与上一个不同家族的候选 | **逻辑缺口与边界**：空值/超限/并发竞态、状态机与回退、副作用泄漏、错误吞掉、假绿 | `.orca-notes/runs/<run_id>/reports/review-logic-<family>.md` |
| reviewer ×1 | 第三个家族，或按需启用 | **UI/组件与交互细节**：组件拆分、四态渲染、保存闭环、重复提交、布局裁切 | `.orca-notes/runs/<run_id>/reports/review-ui-<family>.md` |

纯代码仓库且无 UI 范围时，第三个 worker 可改为 **测试覆盖与可验证性**审查（验收命令是否真的覆盖需求条目、是否只是存在而未断言）。需求文档本身就是被审对象时（PRD 审计），按 `roles/requirement-auditor.md` 派发，其余两个 worker 仍按上表分工。

每个 spec 必须写明：被审范围（文件路径或文档章节）、需求文档路径与版本/hash、冻结输入 manifest、审查焦点、`VERDICT: SHIP | FIX-FIRST | BLOCKED` 输出格式、独占报告路径，并附 `references/worker-lifecycle.md` 与所选并发 Profile 全文。

## 家族约束

reviewer 必须排除被审范围的 authorFamilies。本模式被审范围是既有代码与用户文档时，作者家族未知：按“未知家族”处理，选择候选链中家族互不相同的模型，并在计划中记录该假设。若被审范围包含本 Run 内其他 worker 的写入，按 `SKILL.md「模型路由」` 的 authorFamilies 规则排除后再选。

## 整合纪律

- 每个 reviewer 都是 manifest 中的必需 child，必须有可核验终态、独占报告、输入/输出证据和与当前 revision 对应的 hash；只看到父 worker 的 `worker_done` 或聚合摘要不算 reviewer 完成。
- 三个 worker 全部 `worker_done` 且逐项对账完成后，coordinator 才输出最终整合结论；不等部分结果提前汇报。等待全部完成不等于无限等待：超时、空 wait、停在 prompt、fenced、失败、状态未知或报告缺失都必须进入状态清单。
- 若任一必需 reviewer 或其内部 validator/angle child 未完成、失败、阻塞、未知或证据不足，coordinator 只能输出带逐项清单的 `partial`、`incomplete` 或 `unknown` 汇报，第一行明确“未形成可信的整体完成结论”，不能输出最终整合 verdict。
- 已完成 reviewer 的发现可以临时展示，但必须标明覆盖范围、缺失 child、未完成验证和“不代表最终审查结论”；不得将部分结果包装成 PASS 或 SHIP。
- 整合时按问题去重、按严重度排序，标明每条问题来自哪个 worker 与 `file:line` / 文档章节。
- worker 结论冲突时不自行裁决为“已接受”：列出分歧与各自证据，交用户决定。
- `worker_done succeeded` 只代表审查角色完成并提交报告，不代表 `SHIP`；最终门禁按 `references/coordinator-protocol.md` 的质量门记录。

## 禁止事项

- coordinator 不得亲自阅读被审代码或需求文档后直接输出审查结论，代替 worker。
- 不得用 1 个 worker 的结果复制成多份报告，冒充多智能体交叉审查。
- 不得用 HTTP、gateway、`fetch`、`curl` 或 `ctx_execute` 调模型代做审查；`ctx_execute` 仅可做非推理分析（解析 diff、统计文件）。
- 不得在本模式下顺手修改被审代码；“修复”属于新的写入任务，须重新取得授权并回到对应流水线。
