# Acceptance Scenarios

These are coordinator runbook checks. They do not claim to simulate Orca runtime behavior unless explicitly run in an isolated test harness.

| Scenario | Trigger | Required coordinator behavior | Must remain blocked |
| --- | --- | --- | --- |
| Dirty baseline overlap | Target path is already modified or untracked before Run | Record path/hash, stop writes to that path, ask for explicit handling | No restore, overwrite, stage, or commit of the baseline path |
| Untracked ownership | A worker creates both an owned source file and an unrelated temp file | Compare full `git status --porcelain=v1 -uall`, tracked diff, and each untracked path/hash to Ownership | Unowned temp file cannot be silently ignored or staged |
| Shared writer overlap | Two writers target one `current` workspace | Serialize writes; freeze workspace before tests/review | No review while another worker writes |
| Non-Git parallel documents | Ordinary non-Git document workspace has a recorded complete file inventory/hashes and disjoint chapter-file paths | Allow `parallel-doc` only for unique, non-overlapping file Ownership; keep manifest/spec outside the target directory or exclude separately verified coordinator-owned paths; reconcile all paths against baseline, assemble/finalize one candidate, then run applicable checks and final review | No shared physical file/temp/output path; unclear baseline or overlapping paths requires a new attributable baseline or `shared-serial`; inventory hashes are not a correctness proof |
| Parallel isolated writers | User authorizes worktrees and base SHA is recorded | Start parallel implementation writers in separate child worktrees; coordinator assembles all tested implementation manifests into one candidate before tester enters that existing worktree to write/run tests; freeze it before final review | Candidate assembly must not require passing tests; no tester on an empty baseline, and no local review replacing final cross-file review |
| Test execution failure | Tester reports task complete but command exits non-zero for product bug | Record execution complete and verification failed; assign fix to product owner, then rerun tests | No SHIP, delivery, or commit |
| Review verdict | Reviewer outcome is succeeded but verdict is FIX-FIRST/BLOCKED | Record review task complete and gate failed/blocked; fix/review again or stop | No downstream integration as accepted output |
| Tool failure with recovery | A child tool returns an error but a later result is independently verifiable | Record the failed tool event, recovery/continuation and remaining coverage; mark the child completed only with final evidence | The error cannot be silently ignored or represented as an Orca terminal state |
| Tool failure without final result | A child tool errors and no final report/result can be verified | Mark the child failed or unknown, stop the overall completion claim, escalate or report partial work | No blind retry, silent model swap, duplicate dispatch or parent-level substitute |
| Incomplete child aggregation | Parent worker reports completion while a required child is active, failed, blocked, unknown or missing evidence | Reconcile every manifest child and report partial/incomplete/unknown with IDs, evidence, unfinished items and next steps | No trusted overall completion, PASS or SHIP |
| Reviewer child missing | Any required reviewer/validator child is not terminal or its report/hash is missing | Show completed findings only as provisional and keep the final review verdict blocked | No final integrated verdict from partial coverage |
| Fact/review conflict | Reviewer says SHIP while fact-checker reports unsupported claim | Fact status remains blocking; send factual correction to writer/owner and recheck | Editor cannot change facts; old report cannot authorize final SHIP |
| Editor changes facts | Editor diff changes date, number, source, quotation, or claim | Invalidate previous fact report and repeat fact-check | No final acceptance on stale report |
| Major red-team issue | Major finding is unresolved or coordinator proposes rejection | Require repair or explicit user/designated risk-owner acceptance with rationale | Coordinator cannot self-accept a major finding |
| PPT report contract | Render directory exists but page-by-page check report is absent | Request a report file naming render command, image paths, and results | Render directory alone is not evidence |
| PPT final facts | Slide text or chart values were introduced or transformed after document fact-check | Follow coordinator-protocol「完成状态与质量门」: run fact-checker against the frozen slide artifacts before final review | Earlier document report or visual self-check cannot authorize the final slide facts |
| Duplicate Delivery | Same delivery/message is presented again | Deduplicate by Run/Delivery/message key; reconcile against Orca and continue without repeating side effect | No duplicate Task, reply, dispatch, or release |
| Lost mutation response | Orca may have applied an operation but caller got no receipt | Query `request-show`, then Task/Dispatch/terminal; exact replay uses only original request ID and command when allowed | No new request or inferred failure |
| Ledger/Orca mismatch | Local intent or ack record conflicts with authoritative Orca state | Pause all mutations including ack; preserve evidence and escalate | No dispatch, retry, release, ack, or cleanup while ambiguous |
| Acked, ledger not acked | Process stopped after ack but before local ack record | Query authoritative state and repair bookkeeping only | No repeat of business side effect |
| Paginated cleanup | First `worker-list` page has a next cursor or unresolved states | Continue each page using exact opaque cursor; follow `nextAction` and release recovery guide | No claim of complete settlement while active/pending/unknown resources remain |
| User-owned terminal | Resource is pre-existing, reused, setup, coordinator-owned, or user-taken-over | Preserve it and record why it is outside this Dispatch's release ownership | No force close to make a filtered list empty |
| Resource owner responsibility | Coordinator启动的worker由该coordinator负责盘点与结算 | 分页列举worker-list，逐项按nextAction与recovery guide处理；settled Dispatch选择复用/保留/释放，不复用且归属本Dispatch的不得搁置 | nextAction只是建议；未经回执/查询确认不能记为已释放 |
| Retain reason missing | 保留资源未记录依据（预存/复用/setup/coordinator自用/用户接管/不归本Dispatch所有） | 逐项记录保留理由与证据，保留的终端不能汇报成已关闭 | 不记录依据或记为"保留"但无具体理由 |
| Coordinator reporting without evidence | 任何任务类型的汇报只给结论，不披露假设、实际行动、凭证或盲区 | 使用 worker-lifecycle「Coordinator 用户可见汇报契约」的五个锚点；标出自报与 Orca 查询边界、未执行项、待确认项 | 不把“已核实/全面完成”等措辞当成证据 |
| Research/analysis confidence | 调研/分析结论含来源差异或时效性未知 | 对每个关键结论附原始来源、关键摘录/链接、日期和把握度；暴露代理数据、来源缺口等假设 | 不把来源受限的推测写成确定事实 |
| Content/creative assumptions | 文案、设计或策划指令有模糊取舍 | 说明遵循的约束、主动采用的假设，以及为效果作出的取舍 | 不隐去可能改变验收的假设或用户决策 |
| Data operation accounting | 清洗、归档或批量更新发现重复/异常/缺失数据 | 给出输入输出行数/对象数及分类总数，说明异常处理和留存路径，数目应可核对 | 不声称全量完成但不说明被剔除/无法处理项 |
| Development evidence receipt | 开发汇报宣称构建、测试或审查通过 | 给命令、cwd、时间、exit code、关键输出、差异/报告路径及 hash；未运行项目明确标为未执行 | 不虚构运行结果，不以 worker 自报替代 Orca 权威查询 |
| Released but unverified | Resources are released while a child quality gate is failed, unknown or incomplete | Report resource settlement separately from execution and quality status | No claim that release means task success |
| Child result not Orca result | Internal child has a result but its Orca Task/Dispatch state is not reconciled | Keep execution and Orca status separate; query the authoritative state before completion | No promotion of parent self-report to authoritative completion |
| High-risk placement | Task involves deletion, production configuration, safety/compliance, or external publication | Require isolated worktree and verified Manual permissions/equivalent; if current is requested, obtain explicit confirmation | No dispatch on assumed prompt-only safety |
| Model family fallback | Default model unavailable and fallback collides with author family | Skip colliding candidates and test effective model after launch | No review/Red Team acceptance from prohibited family |
| 多作者最终版本 | coder/frontend/tester 或 writer/editor 及修复作者贡献不同家族 | 按被审范围取 authorFamilies 并集；reviewer/fact-checker/editor 排除整个集合，红方另排除相关 reviewer family 集合 | 家族未知或无合法候选暂停；不能自动拆审冒充整体终审 |
| Dispatch ceiling | Planned remaining work exceeds the user-confirmed Run ceiling | Pause new dispatches, show estimate and remaining work, ask whether to increase ceiling | No silent hardcoded ceiling or automatic limit bypass |

## 补充崩溃窗口与交接场景

| 场景 | 判断证据 | 责任人与恢复动作 | 停止条件 |
| --- | --- | --- | --- |
| intent 已落盘、调用前崩溃 | intent/request 与 Task/Dispatch 状态 | coordinator 查询权威状态；不能仅凭缺回执推断未执行 | 无法唯一归因则停止所有 mutation |
| Orca 已执行、回执未记账 | request-show 原回执及 Task/Dispatch ID | coordinator 补记 receipt/acted，不创建替代任务 | absent 不是未执行证明 |
| acted 已记账、ack 前崩溃 | Delivery/message ID 与副作用回执 | coordinator 去重后仅 ack | 回执冲突先停止 |
| ack 已成功、本地未记 acked | Orca 权威 Delivery 状态 | coordinator 补记账本，不重复业务副作用 | 不可对账先停止 |
| worker 失联或 consumer_fenced | fleet observation、当前 preamble/Dispatch | coordinator 查询证据；fenced worker 停止完成事件 | unverifiable 不授权重试或释放 |
| 未提交 worktree 交接 | manifest、tracked patch、逐项 untracked/hash | coordinator 按 manifest patch/文件转移，或请求提交授权 | 不用 merge 假装带入未提交结果 |
| 审查期间对象变化 | 审查前后 hash 与完整 status | coordinator 保全现场并作废审查；owner 修复后升 revision | 不自动回滚或猜测归因 |
| Ownership 闭包缺失 | schema/生成物/fixture/报告/渲染路径表 | coordinator 补唯一 owner 与串行交接依赖 | 路径未归属不派写入 |

## 文字走查方式与限制

逐行对照 SKILL.md「拆解与执行计划」「Orca 启动、spec 与监督」「验收、交付、清理」和 coordinator-protocol 的对应门禁，检查判断证据、责任人、恢复动作与停止条件是否齐全。上述场景的决策责任人为 coordinator，产品/事实修复交原 owner，测试交 tester，风险接受交用户或指定 risk owner。本文是静态走查清单，不是已执行的真实故障注入记录。validator/Node 负例仅验证文本契约，不证明 Orca exactly-once、权限隔离、provider 合规、预算或 worker 诚实。

## Evidence fields

For each executed gate, record the exact command or checklist, working directory, input version/hash, timestamp, exit code, concise output or report path, and `launch.effective` when applicable. Redact credentials and sensitive values. A worker's prose summary without evidence is not a passed gate.
