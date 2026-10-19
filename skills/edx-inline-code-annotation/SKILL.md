---
name: edx-inline-code-annotation
description: "Use when a user-facing reply includes code for explanation, review, comparison, or a proposed snippet. Add concise `// ←` annotations to non-obvious variables, fields, states, and side effects so the reader can understand the snippet without opening the source. Apply only to chat code, never code written into project files; skip when the user explicitly requests clean unannotated code."
---

# Inline Code Annotation

## Scope

本 skill 只约束聊天回复中展示的代码。它不改变写入项目文件的注释风格，也不要求对纯命令输出、配置片段或日志逐行加注释。

适用于：

- 解释、分析、review 时引用的代码；
- 示例、方案草稿、伪代码；
- BAD / GOOD 对比片段。

用户明确要求干净代码时，以用户要求为准；可以在代码块外用一句话解释关键假设，而不强行插入注释。

## Annotation rule

为每个**首次出现且不自解释的关键项**添加行尾 `// ←` 注释。关键项包括：状态、接口字段、提交字段、派生值、业务常量、非自解释参数、条件分支标志和有业务副作用的 handler。

注释说明业务语义或数据去向，而不是复读变量名：

```ts
const forecastData = response.data; // ← 预报接口返回的原始数据 [ForecastResponse]
const activeIndex = timeline.findIndex(item => item.isCurrent); // ← 当前时刻位置，用于默认高亮
```

### 准确性边界

- 只在有证据时标注接口来源；来源不明写“示例数据”或“待确认”，不要凭名称编造 endpoint。
- 不把技术调用关系当成业务含义；`// ← 在 Foo 中被调用` 不属于字段标注。
- 同一变量在同一片段后续透传时不重复标注；新出现的业务字段仍单独说明。
- 每条注释尽量一句、约 30 字以内；长解释放在代码块外。
- 对 interface/type 的字段逐项标注；多行参数也逐项标注。

## What to leave unannotated

以下内容通常不需要注释：循环索引、框架惯例 setter、名字已经说明来源的简单解构，以及只在极短局部范围内使用的自解释变量。不要为了满足形式而给每一行都加噪音。

## Format constraints

- 注释放在被说明代码的行尾，使用 `// ←`；
- 保持原代码语义、缩进和可复制性；
- 注释必须与代码语言兼容：shell、JSON、YAML 等没有 `//` 时，使用该格式允许的注释，或改在代码块外说明；
- 保留代码块语言标签；不要把注释放入用户会直接复制执行的 shell / JSON 载荷中；
- 项目文件中的代码不受本 skill 的行尾标注要求影响。

## Collaboration boundaries

- `understanding-code-logic` 可以负责调用链与状态解释；本 skill 只保证聊天代码片段中的关键项可读。
- `api-field-contract-guard` 负责字段是否已由契约确认；本 skill 只引用该结论，不把注释当成契约证据。
- `inline-code-annotation` 与 `inline-code-annotation` 不重复触发；本 skill 不负责代码实现质量或格式化。

## Completion checklist

发送含代码的回复前确认：

- 代码块中的关键项已按首次出现原则标注，或明确属于自解释项；
- 标注描述的是业务含义、来源或去向，而非变量名复读；
- 接口来源与契约状态没有被注释夸大；
- shell、JSON、YAML 等片段仍可安全复制；
- 没有把聊天注释规则带入项目文件；
- 用户要求 clean code 时已移除行内标注，并在代码外补足必要说明。
