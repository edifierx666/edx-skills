---
name: edx-orca-multi-model-orchestrator
description: >-
  在 Orca 中需要多 agent/多模型协作代码、调研、文档、PPT 或 PRD 审计时使用，包括“多模型 review”“多个智能体 review”。本 Skill 触发即走 orchestration；orca-cli 用于完整 handoff 或底层 terminal/worktree 控制。一个 agent 可独立完成的任务不要使用本 skill。
---

# Orca 多模型总指挥

你是 coordinator，负责 orchestration 拆解、模型路由、worker 派发、监督、质量门与整合。触发本 Skill 即使用 `orchestration`；按当前版本指南创建 Run/Task 并用 `worker-start` 启动角色 worker，之后跟进至验收和资源结算。Run 不会自行调度 worker。`orca-cli` 只用于完整 handoff 或底层 terminal/worktree 控制，不代替监督编排。

每个 worker 必须核验 Dispatch receipt/handle。仅查 help/状态不算启动。启动失败或不确定时停止报告；禁止用 HTTP、gateway、`fetch`、`curl` 或 `ctx_execute` 调模型代做审查。`ctx_execute` 可做非推理分析。

review 代码、对照需求文档核查或“多个智能体 / 多模型 review”命中 [`references/multi-agent-review.md`](references/multi-agent-review.md) 极速模式：只读任务，直接建 Run 并**至少并发派发 2 个、默认 3 个不同家族的只读审查 worker**，不先索要计划确认；coordinator 读代码只为写 spec，严禁自己出结论代替 worker。

## 参考资料

- 安装与启动：[`references/install.md`](references/install.md)、[`references/agent-launch.md`](references/agent-launch.md)、[`references/worker-lifecycle.md`](references/worker-lifecycle.md)。
- 多智能体极速 review：[`references/multi-agent-review.md`](references/multi-agent-review.md)。
- 协议与恢复：[`references/coordinator-protocol.md`](references/coordinator-protocol.md)、[`references/recovery.md`](references/recovery.md)、[`references/model-catalog.md`](references/model-catalog.md)、[`references/acceptance-scenarios.md`](references/acceptance-scenarios.md)。

## 预检

确定交付类型、验收、基线、数据策略与 provider/family。敏感度或外网策略未知时不得派发（命中 `references/multi-agent-review.md` 的本地只读 review 按该文件默认只读处理）。高风险/不可逆任务要求隔离 worktree 和已核实的 Manual permissions；worktree、Ownership 和提示词不是权限沙箱。先锁定唯一 Orca 可执行文件，加载 `orchestration` 指南执行；不要切可执行文件或把 handoff 与 supervised worker 混成重复启动。

记录 repo/HEAD/SHA、`git status --porcelain=v1 -uall`、diff、untracked/目标文件 hash、Ownership 和 dispatch ceiling（极速模式默认 6）；非 Git 记录文件清单/hash。dirty/untracked 与目标 Ownership 重叠时停止询问，禁止 restore/reset/stash/clean。manifest/spec 放 `.orca-notes/runs/<run-id>/`；只在 Git 仓库时 `.orca-notes/` 加入该仓库 `.git/info/exclude`，不改共享 `.gitignore`。联网 researcher/fact-checker 用干净无密钥 worktree，否则由 coordinator 供脱敏副本。

## 模型路由

### 角色索引

| 角色 | 文件 | 路由键 | Ownership |
| --- | --- | --- | --- |
| researcher | `roles/researcher.md` | researcher | 独占资料摘要；网页访问限干净 worktree |
| planner | `roles/planner.md` | planner | 独占大纲 |
| reviewer | `roles/reviewer.md` | reviewer | 被审对象只读，独占报告文件 |
| fact-checker | `roles/fact-checker.md` | fact-checker | 交付物只读，独占核查报告 |
| red-team | `roles/red-team.md` | red-team | 攻击对象只读，独占报告文件 |
| requirement-auditor | `roles/requirement-auditor.md` | requirement-auditor | PRD 只读，独占审计报告 |
| writer | `roles/writer.md` | writer | 独占分配章节 |
| editor | `roles/editor.md` | editor | 独占分配稿件；不改事实 |
| slide-designer | `roles/slide-designer.md` | slide-designer | 独占幻灯片源、产物和渲染目录 |
| architect | `roles/architect.md` | architect | 产品对象只读，独占方案报告文件 |
| coder | `roles/coder.md` | coder | 独占产品文件；测试归 tester |
| tester | `roles/tester.md` | tester | 独占测试文件/fixture；按阶段执行 |
| frontend | `roles/frontend.md` | frontend | 独占 UI 产品文件；测试归 tester |

快速添加角色：复制最接近的 `roles/*.md` 作为模板，替换角色职责、输入/输出、验收、报告路径与 Ownership；把新角色加入本索引和下方路由表，路由模型使用目录已有 alias。若需新模型 alias，先确认完整 ID、provider 与开发者 family 后更新 `references/model-catalog.md`，不能按名字猜测。检查新角色符合 `references/worker-lifecycle.md`，补齐上下游依赖和验收场景；最后运行本目录的 `node scripts/validate.mjs` 与 `node --test tests/`。

每个角色恰好对应一条路由；coordinator 不派发自己。完整模型映射与候选家族在 `references/model-catalog.md`；路由表只填模型意图名：

| 路由键 | 默认模型意图 | 默认 effort |
| --- | --- | --- |
| `coordinator` | Claude Opus 5.5 | max |
| `researcher` | gemini-3.8-flash | max |
| `planner` | Claude Opus 5.5 | max |
| `reviewer` | 按 authorFamilies 及 model-catalog 选 | max |
| `fact-checker` | gemini-3.8-flash | max |
| `requirement-auditor` | Claude Opus 5.5 | max |
| `red-team` | gpt-6-astra | max |
| `writer` | Claude Opus 5.5 | max |
| `editor` | GPT-6.1 Sol | max |
| `slide-designer` | gemini-3.8-flash | max |
| `architect` | Claude Opus 5.5 | max |
| `coder` | GPT-6.1 Sol | max |
| `tester` | DeepSeek V4.1 Flash 1017 | max |
| `frontend` | gemini-3.8-flash | max |
| `bulk` | DeepSeek V4.1 Flash 1017 | max |
| `chores` | DeepSeek V4.1 Flash 1017 | max |
| `escalation` | gpt-6-astra | max |
| `avoid` | `gs/gpt-5.6-sol`、Gemini 4 Argon | 禁用 |

显示名必须先映射为 `references/model-catalog.md` 中的精确 ID/family，再与本次 `$MAGPIE_BASE_URL/v1/models` 的实时 `data[].id` 做区分大小写的精确交集。`MAGPIE_BASE_URL`、`MAGPIE_TOKEN` 必须由用户/环境配置，缺失则停止；禁止硬编码 token、打印 token、shell xtrace 或把 token 写入 spec/log。

```sh
curl --fail --silent --show-error "$MAGPIE_BASE_URL/v1/models" \
  -H "Authorization: Bearer $MAGPIE_TOKEN"
```

规划阶段先为**每一个审查 gate**计算 authorFamilies 排除后的候选 ID、模型家族、capability 和 effort。authorFamilies 按被审范围逐文件归属：只修改测试的 tester 只进入测试文件范围，不进入产品代码家族集合；writer/editor/修复者同理。reviewer、fact-checker、editor 排除各自范围的完整 authorFamilies；red-team 另外排除 reviewer family。未知家族或无候选，在计划中停止并交用户决定，不得到执行中途才阻塞，也不能把整体终审拆小来绕过家族约束。极速模式作者家族未知的处理见 [`references/multi-agent-review.md`](references/multi-agent-review.md)。

每次启动记录 `launch.requested` 和 `launch.effective`。后者只证明 Orca 层请求/采用了什么，不证明 gateway 最终 reasoning 档位。网关日志或模型配置未核实前，按“请求 max，生效档位待核实”汇报；如何核实见 `references/recovery.md`。模型候选不是质量、速度或价格保证。

## 拆解与执行计划

先确定完整 Ownership 闭包：产品、API/schema、迁移、配置、生成物、测试、报告和渲染输出；每条可写路径唯一 owner；依赖表示真实先后，超过 4 层先解释原因。启动前确认角色、模型/family、Ownership、profile、dispatch ceiling 和验收。只读 review 命中 [`references/multi-agent-review.md`](references/multi-agent-review.md) 极速模式时直接派发，不先取得计划确认；其余只读 review 计划与数据策略确认后可派发 worker。写入、并行或高影响操作仍须相应授权。

默认 `shared-serial`；普通文档的独立章节可选 `parallel-doc`（支持非 Git）；代码并行写入仅在用户明确授权后选 `parallel-worktree`。各模式的基线、Ownership、候选组装与冻结步骤只在 [`references/coordinator-protocol.md「三种并发 Profile」`](references/coordinator-protocol.md#三种并发-profile) 维护；派发时将所选模式全文附到相关 worker spec。

典型依赖：

- 代码：architect（需要时）→ coder/frontend → 候选组装 → tester → 冻结 → 最终 reviewer →（复杂任务 red-team）→ 验收。
- 文档：researcher → planner → writers → fact-checker → 事实 owner 修正并复核（最多 2 轮）→ editor → 最终 fact-check（如编辑影响事实）→ 最终 reviewer →（复杂任务 red-team）→ 验收。
- PPT：文档事实门后 slide-designer 生成最终 PPT/HTML/Marp 与渲染报告；随后 fact-checker 核对幻灯片文字/图表数据，再做冻结版本终审。
- PRD 审计：requirement-auditor。用户自己写的 PRD 若 FIX-FIRST/BLOCKED，不派 worker 改 PRD；将方案 A/B 与待决项交用户确认，把决策写进下游 Constraints。
- 多智能体 review：按 [`references/multi-agent-review.md`](references/multi-agent-review.md) 极速派发，≥2 个、默认 3 个不同家族只读审查 worker 并行；只派 1 个或 coordinator 亲自出结论均不合格。

默认只对整合后的冻结版本做最终 reviewer 和 red-team；parallel-worktree 中局部审查可选且不能替代最终门。文档事实核查由 fact-checker 提供事实门，reviewer `SHIP` 不能覆盖未处理的 wrong/unsupported/outdated/link-broken。critical/major 风险未修时只可由用户或事先指定 risk owner 明确接受并留证。每个 `gate × review scope` 最多 2 轮修复；超限交用户。多智能体 review 的整合与禁止事项见 [`references/multi-agent-review.md`](references/multi-agent-review.md)。

## Orca orchestration Run/Task 编排

本 Skill 默认进入 supervised loop。先 `run-create` 得到 Run ID；Run 不会创建 worker。每个角色 spec 必须独立、自包含。不要将 spec 直接嵌入命令源码、使用 `eval` 或 shell xtrace；先写入 `.orca-notes/runs/<run_id>/specs/<task>.md`，记录 SHA-256 和输入 revision，再用当前 CLI 支持的 `--spec <text>` 以一个 quoted 参数传入：

```sh
spec_file='.orca-notes/runs/<run_id>/specs/<task>.md'
shasum -a 256 "$spec_file"  # 原 spec 文件 hash
orca orchestration task-create --run <run_id> \
  --spec "$(cat "$spec_file")" --task-title "<title>" --json
```

双引号中的 command substitution 输出作为单个参数，不会把文件内容里的反引号或 `$` 重新解析执行。Shell 会移除替换结果末尾的换行；账本同时记录原文件 SHA 和按相同读取方式得到的传入文本 SHA。不要使用未经当前 CLI help 确认的 `--spec-file`。

新 worker 必须显式 `--run`、`--task`、`--worktree`/placement、`--agent claude`、已解析 `--model`、`--effort`；复用 `--terminal` 时 CLI 禁止带 agent/model/effort，必须使用该 terminal 的准确 worktree。示例以当前 `worker-start --help` 核准后使用。`--retry-of` 重新写 task 与 placement；超时或非零返回不能盲重启。

一个 coordinator 负责一个 Run。收到 Delivery 后按 `runId + deliveryId + messageId` 去重：写 intent、执行副作用、保存回执/ID、标记 acted，再处理完整批次并 ack。响应丢失先 `request-show`；pending 仅以同 request ID 原样精确重放一次；absent 不是未执行证明。无法唯一对账时暂停 ack、dispatch、retry、release 与其他 mutation，不发新 request 猜测重做。本地 ledger 不保证 exactly-once。

汇报前按 manifest 核对 worker/Task/Dispatch 和 child;必需 child 未完成、失败、阻塞、未知或缺证据时,首行写"未形成可信的整体完成结论",不得写成 PASS、SHIP 或完成。

| 消息/事件 | 协调器动作 |
| --- | --- |
| question | 对原 message ID 回复；同一问题重放不重复回复 |
| escalation | 按 spec/权限/数据策略补充或暂停并询问 |
| worker_done | 校验当前有效 Task/Dispatch、outcome、报告、输入 hash 和证据；先分开记录 execution/verification/review/fact 状态，再决定终端去向 |
| consumer_fenced | 旧 worker 立即停止；不得用旧 ID 发完成/重试消息 |
| 空 wait/timeout/heartbeat | 是观察点，不代表失败；遵循 `references/recovery.md` |

`worker_done succeeded` 仅代表 worker 完成角色任务并报告；不是测试 PASS、事实 PASS 或 reviewer SHIP。测试命令须记录实际 exit code；下游只按 coordinator ledger 的质量门状态前进，不伪造 Orca API 字段。多智能体 review 下全部 worker 完成后才整合，规则见 [`references/multi-agent-review.md`](references/multi-agent-review.md)；完成报告发送后，worker 停止 check/轮询/新工作，完整规则见 `references/worker-lifecycle.md`。

## 验收、交付、清理

报告必须是实际存在的文件；`--report-path` 不可填目录。architect、reviewer、red-team 使用独占报告文件；幻灯渲染目录作为 artifact 单独列出。验收记录命令、cwd、时间、exit code、输入/输出 hash、报告路径及 `launch.effective`；报告缺失即不接受。

终审只能审最终冻结版本的完整 diff、tracked/untracked manifest、artifact hash。新文件逐项检查，不能只用 `git diff --stat`。未授权默认不提交；若用户授权，只 stage 基线干净且 manifest 归属明确的路径。未提交 worktree 不能靠 merge 转移；按 manifest 逐文件/patch 转移并核 hash，或另请用户授权提交。转移后重新验收。

`worker-list` 用 `--run <run_id>` 显式 scope 并分页直到结束；处理 active/reclaimable/retained/release_pending/release_unknown/released 和每项 `nextAction`。用户/预存/复用资源不强制关闭；release unknown 走 recovery guide，不能用 `terminal close` 替代。删除 worktree、文件、分支，push、PR、发布/分享均须分别得到用户授权。细节见 `references/coordinator-protocol.md`。

## 校验

在本 Skill 目录运行：

```sh
node scripts/validate.mjs
node --test tests/
```

校验是静态文本契约检查和负例测试，不证明 Orca 运行时崩溃恢复、真实权限隔离、provider 合规、费用或 worker 诚实。每 Run 计划的 dispatch ceiling 由用户确认（多智能体 review 极速模式默认 6，见 [`references/multi-agent-review.md`](references/multi-agent-review.md)）；临近额度时先停派并询问是否追加，不自动触顶后中断。