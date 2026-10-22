# Orca 工具边界

## 默认：orchestration

本 Skill 管理的是拆解、派工、等待、质量门和资源结算，因此多模型 review 与多 agent 协作默认使用当前版本 `orchestration` supervised loop：创建或绑定 Run，使用 `worker-start` 启动每个角色 worker，再用 `check --wait`、`worker-read`、`worker_done` 和 `worker-list` 完成闭环。

`worker-start --spec` 可在一条受监督命令中创建 Task 和 attempt；有依赖或已知 Task 重试时按当前指南使用 `task-create` 与 `worker-start --task`。启动后核对 Dispatch receipt、outcome、Task/Dispatch ID 和 worker handle。仅查 `--help`、`worktree current`、`run-list`、`task-list` 或模型 API ping 都不是 worker 已启动。

## `orca-cli` 的边界

`orca-cli` 用于完整 handoff：创建或选择 worktree、启动另一个 Agent、交付 prompt 后由当前 Agent 停止跟进；也用于底层 terminal/worktree 管理、读取和发送终端输入。完整 handoff 不创建 coordinator-owned Run/Task，不使用 `check --wait` 监督完成。若用户要求协调、等待、DAG、质量门或结果汇总，不得把 handoff 当作 orchestration 替代。

不要对同一角色先用 `orca-cli agent launch`，再用 `orchestration worker-start` 重复启动。具体 flags 以本次选定 Orca 可执行文件的版本指南和 CLI help 为准。

## 禁止模型 API 回退

多模型角色的模型推理必须由其 Orca Agent/worker 执行。禁止用 `ctx_execute`、JavaScript `fetch`、`curl`、`child_process`、直接 HTTP 或本地 gateway 的 `/v1/chat/completions` 生成审查结论或替代角色交付。

`ctx_execute` 仍可用于不调用模型的本地分析，例如解析或筛选 diff、统计文件、汇总日志。读取 `$MAGPIE_BASE_URL/v1/models` 等模型元数据不等于生成模型结论，但不得用该请求测试模型生成能力后把 API 当作 worker。

若 Orca CLI 不可用、`worker-start` 被拒绝、模型解析失败、receipt 缺失或结果不确定，停止该角色，并向用户报告精确命令、错误和未完成工作。不得静默切换到 HTTP/gateway、其他 Agent 框架或协调器亲自调用模型。恢复前先按当前版本指南查明 Orca 状态。
