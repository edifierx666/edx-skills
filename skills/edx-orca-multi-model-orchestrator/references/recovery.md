# 恢复与预算

Orca 版本匹配指南优先。预检只读取 `orca skills get orchestration`；需要恢复时再读取 `orca skills get orchestration --reference recovery-and-cleanup`。参数未知时使用当前同一个 Orca 可执行文件的 `--help`，不得从旧版本或记忆猜 flag。

## 启动、超时与未知状态

- `worker-start` 只在 ready 时返回 0。非零先检查原回执中的 `failedStage`、`residualResources` 和恢复动作；不能直接重复启动或换模型。
- 单 Task 默认最长监督时长 60 分钟。超时后对原 Dispatch 使用 `worker-read --dispatch <id> --json` 保存最后可读输出并汇报用户；不自动 stop、abandon、retry 或 release。若已确证 agent 仍在等待人类 prompt，则向用户报告等待信息，不判失败。
- 连续 3 次 `check --wait` 返回空结果后，对每个仍运行 Dispatch 调 `worker-show --dispatch <id> --json`。`observation.agentWait` 非空表示停在需要人类处理的 prompt，立即向用户报告 Dispatch、等待原因及所需操作，不能仅继续空等；若字段缺失或 observation 不可验证，按未知处理。不要把 null 与缺字段混为一谈。
- `outcome_unknown`、超时、断线、`unverifiable`、TUI idle 或空 transcript 不是失败证明。先用 `worker-list`、`worker-show`、`worker-read` 和 request receipt 查证；只有 recovery guide 指示的正向证据允许 stop/retry/release。

## 重试与修复轮次

- 为每个 `gate × review scope` 独立计修复轮次，最多 2 轮；包括 reviewer FIX-FIRST、测试失败修复、文档事实核查修复。达到上限或仍未通过时停止并把证据与选择交用户。
- 同 Task 启动尝试遵守 Orca 熔断（最多 3 次，含首次）；不通过新 Task 绕过熔断。
- 不确定 mutation 有 request ID：先 `request-show`；仅 pending 且 CLI 指南允许时，按相同 request ID 精确重放原命令，最多一次后再查证。`absent` 不是没执行。无 ID 或无法唯一对账时暂停 ack、dispatch、retry、release 和其他 mutation。
- 取消 Task 按当前 recovery guide 先明确 stop 或 abandon 决策，再记录取消原因。reset 是破坏性操作，未经用户明确授权不得执行。

## 规划派发额度

- 不设统一 16 次 Run 硬上限。计划阶段逐关估算 worker dispatch（含计划审查、测试、最终审查、红队和修复预留），给出一个可计数的 Run ceiling，与拆解计划一起交用户确认。该 ceiling 是经过用户确认的执行额度，不是价格/美元预算。
- 派发前台账预扣一次额度；收到确定未启动的 Orca 回执后按回执记账，不确定结果保留占用并先对账。接近 ceiling 时（预计剩余任务需要超过剩余额度）停止新派发，列出剩余工作并询问是否增加额度；不得做到一半触顶后无预警停住。
- 精确 request 重放不是新的 worker dispatch，但要单独计重放次数。真实费用只有在 provider 给出可核验用量/价格数据时才报告。

## Thinking/Effort 核实

`launch.effective` 只证明 Orca 接受/解析的 launch 配置，不证明下游 gateway 最终采用相同 reasoning/thinking level。模型配置的 `thinking.levels` 只证明声明支持的档位；实际采用的档位须关联到该请求的 gateway 日志，例如目标版本 CLIProxyAPI 确实输出的 `thinking: processed config to apply ... level=`（没有该日志时不能按示例猜测）。没有请求级证据时统一汇报“请求 max，生效档位待核实”（非 max 时填实际请求值），禁止把配置支持或 `launch.effective` 改写成网关生效事实。
