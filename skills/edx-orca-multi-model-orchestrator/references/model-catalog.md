# 模型别名目录

本文件是路由显示名到已知模型 ID 与开发者家族的 alias 目录。ID 来自 2026-10-21 本机 Magpie `providers.json` 配置；它证明该 ID 曾在本机 provider 配置中登记，不证明当前网关在线、账号有权限或 `data[].id` 返回值完全相同。每个 Run 仍须从 `$MAGPIE_BASE_URL/v1/models` 获取实时 `data[].id`，只在目录 ID 与实时 ID **完全一致**时使用。未知、新增或不唯一的 ID 必须暂停询问；保留实时列表中的完整 ID，不要自行去除/添加 provider 前缀。

| 路由显示名 | 已知 provider/model ID | provider | 开发者家族 | 状态/备注 |
| --- | --- | --- | --- | --- |
| `Claude Opus 5.5` | `claude-opus-5-5` | `my` | Anthropic | 本机已配置 |
| `claude-fable-5-1` | `claude-fable-5-1` | `my` | Anthropic | 本机已配置 |
| `GPT-6.1 Sol` | `gpt-6.1-sol` | `my` | OpenAI | 本机已配置 |
| `gpt-6-astra` | `gpt-6-astra` | `my` | OpenAI | 本机已配置 |
| `gemini-3.8-flash` | `gemini-3.8-flash` | `my` / `antigravity` | Google | 多个 provider，Run 计划必须记录选定 ID |
| `Grok 4.7` | `grok-4.7` | `my` / `grok` | xAI | 本机已配置 |
| `DeepSeek V4.1 Flash 1017` | `DeepSeek-V4.1-Flash-1017` | `my` | DeepSeek | 精确大小写按本机配置保留 |
| `DeepSeek V4.1 Flash` | `deepseek-v4.1-flash` | `workbuddy-ai`、`codearts` | DeepSeek | 与 Flash 1017 是不同 ID，不可互换 |
| `Qwen3.8 Max` | `qwen3.8-max` | `my` | Alibaba | 本机已配置 |
| `GLM-5.3-FlashX` | `glm-5.3-flashx` | `my` | Zhipu | 本机已配置；不等同 `glm-5.3-flash` |
| `GLM-5.3-Flash` | `glm-5.3-flash` | `codearts` | Zhipu | 与 FlashX 是不同 ID，不可互换 |
| `Gemini 4 Argon` | `gemini-4-argon` | `my` | Google | 禁用：暂停使用，不得分配 |
| `gs/gpt-5.6-sol` | `gs/gpt-5.6-sol` | 待实时确认 | OpenAI | 禁用：不得分配；不据命名空间推断 provider |

若模型列表为同一 alias 提供多个完整 ID，不能自行选“最近”或做 provider 前缀拼接；应按用户确认的 provider/capability 选择，或暂停询问。provider 字段也不是开发者家族：例如经 `my`、`antigravity` 或其他代理暴露的 Gemini 仍属于 Google；`gs/` 之类路由 namespace 不能单独证明模型来源。

## 常见前缀速查

仅用于初步识别，不能替代上表与 provider 元数据核验：

| 开发者家族 | 常见前缀/系列 |
| --- | --- |
| OpenAI | `gpt-`、`chatgpt-`、明确的 `o1` / `o3` / `o4` 推理系列 |
| Google | `gemini-`、`gemma-` |
| Anthropic | `claude-` |
| DeepSeek | `deepseek-` |
| Alibaba | `qwen`、`qwq-` |
| xAI | `grok-`；`groq` 是推理服务商名，不是 xAI 模型家族 |
| Zhipu | `glm-`、`chatglm` |
| Moonshot AI | `kimi-`、`moonshot-` |
| MiniMax | `minimax-` |
| Meta | `llama-`、`meta-llama/` |
| Mistral AI | `mistral-`、`mixtral-`、`codestral-`、`ministral-`、`magistral-` |
| Cohere | `command-` |
| Microsoft | `phi-` |
| Baidu | `ernie-` |
| ByteDance | `doubao-`、`seed-` |
| Tencent | `hunyuan-` |
| 01.AI | `yi-` |

托管平台或网关 namespace 不一定是模型开发者；衍生、微调、混合模型家族不明时，不得用前缀猜测跨家族独立性。

## 版本判断

只在同一开发者家族、同一产品线且厂商编号规则相同时，较高的数字版本通常表示较新的版本。按分段整数比较（示意 `2.10` 晚于 `2.9`），不按小数字符串比较。不能跨厂商、系列、模态比较版本号；`pro`、`flash`、`mini`、`thinking`、`70B` 等通常描述档位/能力/参数量，不代表发布时间。日期后缀只有在厂商明确说明格式时才作日期比较。`latest`、`preview`、`experimental` 可能是浮动别名。更新不代表更强、更适合、更便宜或稳定；绝不因更高版本自动替换路由、越过禁用项或跳过用户确认。

## 交叉家族候选顺序

每个 Run 先按 `$MAGPIE_BASE_URL/v1/models` 的在线列表求候选 ID 与实时 ID 的精确交集，再按以下家族顺序跳过 `authorFamilies`、已选 reviewer family 和禁用项；随后核验 capability、effort 支持与用户策略。在线列表之外的目录 ID 不能派发。

- **Reviewer**：若所有作者都不是 OpenAI，优先 OpenAI（`gpt-6.1-sol`、`gpt-6-astra`）；否则优先 Anthropic（`claude-opus-5-5`、`claude-fable-5-1`）；之后依序尝试 Google（`gemini-3.8-flash`）、xAI（`grok-4.7`）、DeepSeek（`DeepSeek-V4.1-Flash-1017`）、Alibaba（`qwen3.8-max`）、Zhipu（`glm-5.3-flashx`）。
- **Red-team**：按 OpenAI（`gpt-6-astra`）、xAI（`grok-4.7`）、Anthropic（`claude-opus-5-5`）、Google（`gemini-3.8-flash`）、DeepSeek（`DeepSeek-V4.1-Flash-1017`）、Alibaba（`qwen3.8-max`）、Zhipu（`glm-5.3-flashx`）尝试。

候选为空、家族未确认或 family/capability 校验失败时，在计划阶段列明缺少的家族/候选，请用户决定；不得到派发中途才静默降级，也不得拆分审查来冒充完整最终审查。此目录是候选顺序，不是能力排名或服务保证。
