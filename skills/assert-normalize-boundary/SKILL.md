---
name: assert-normalize-boundary
description: Use when dirty input, scattered null checks, inline type coercion, or multi-source payload fallbacks should be pulled into assert/normalize functions at the boundary instead of leaking into business logic.
---

# Assert Normalize Boundary

## Overview

把脏数据处理前置到边界层，让核心业务逻辑只处理结构稳定、语义明确的数据。

这个 skill 的目标不是“多写几个校验”，而是把校验、归一化、适配、默认值补全从业务流中抽走，避免核心逻辑被防守代码污染。

它关心的是：

- 哪些输入属于系统边界
- 哪些规则应该由 `assertXxx` 负责
- 哪些补齐与收敛应该由 `normalizeXxx` 负责
- 哪些判空 / fallback / payload 组装本该前置，却错误地散落在业务流或视图层

## When to Use

Use when the main problem is boundary cleanup rather than feature delivery itself.

典型请求：

- “不要在业务代码里到处判空”
- “接口返回很脏，帮我整理成稳定结构”
- “这段代码里全是 `a?.b?.c || '-'`，收口一下”
- “给这块补 assert / normalize 层”
- “把 payload 组装改成单一来源”
- “重构这个 adapter / builder，让脏数据别再污染业务层”
- “把临时类型收敛都提到边界层去”
- “不要让 UI 自己做空值回退”

Do not use as the primary skill for:

- 纯讲代码逻辑
- 纯 UI 样式调整
- 普通 bug 定位但核心问题不是边界收口
- 按钮没反应、请求没发出、分支没触发，这类第一性问题是“有没有执行”的场景
- 主要目标是完成编辑页 / 表单保存闭环

优先级规则：

- 主问题是“怎么工作” → `understanding-code-logic`
- 主问题是“编辑动作怎么形成保存闭环” → `editable-flow-closure`
- 只要第一性问题是 submit / handler / effect / request 到底有没有执行，即使同时提到 payload、判空或 normalize，也先切给 `reachable-flow-audit`
- 即使中途会补 assert / normalize，只要最终目标是完成编辑保存闭环，也由 `editable-flow-closure` 主导
- 主问题是“边界层怎么收口脏输入” → 本 skill

## Core Philosophy

**业务逻辑纯净化。**

所有类型收敛、默认值补全、结构断言、字段适配，都应该提升到边界层完成，实现“脏水进，净水出”。

一旦数据进入核心业务流，就不应该再到处看到：

- 临时判空
- 临时兜底
- 临时类型收敛
- 临时多源 fallback
- 临时 payload 修补

## Two Contracts

### `assertXxx`

职责：只验不改。

必须满足：

- 只负责强规则校验，例如权限、必填项、关键前置条件
- 校验通过返回 `void`
- 校验失败直接 `throw Error`
- 异常里要带明确字段和原因
- 保持纯净，禁止读写外部状态，禁止发起网络请求
- 禁止返回 boolean

适合放进 `assertXxx` 的典型内容：

- 权限校验
- 必填字段存在性
- 关键上下文是否齐备
- 当前操作是否合法
- 不满足就必须立即阻断流程的规则

### `normalizeXxx`

职责：归一化清洗。

必须满足：

- 负责类型转换、默认值补全、结构稳定化
- 只补齐缺失字段，保留原字段命名与原始结构，返回可直接进入业务流的稳定对象
- `normalizeXxx` 不负责重命名、裁剪或抛错
- 普通脏输入不应把错误扩散进核心业务流
- 调用方拿到结果后，不应再继续做临时类型收敛或判空补丁

适合放进 `normalizeXxx` 的典型内容：

- `null` / `undefined` / 空串的兜底
- 数字 / 字符串 / 布尔值的入域前收敛
- 数组 / 对象结构的稳定化
- 视图层和业务层都共享的默认值补齐

## Required Workflow

默认按这个顺序处理：

1. **识别边界**：先找清脏数据从哪里进入系统
2. **`assertXxx` 拦截硬错误**：该阻断的直接阻断
3. **`normalizeXxx` 统一结构**：把剩余输入变成稳定对象
4. **边界处集中处理异常**：必要时只放一个 `try/catch`
5. **核心逻辑直接消费净数据**：默认不再写临时收敛代码

## Output Determinism

### UI 输出

- 视图层只接收最终确定值
- 字段优先级、空值回退、格式化都前置到 adapter / gateway
- 不要把 `a?.b?.c || '-'` 留在组件渲染里
- 不要把“显示值”和“业务值”的兜底逻辑掺在 JSX / 模板里

### API 请求

- 每个核心入参都必须来源唯一且明确
- 允许使用 `{ ...source, extra }` 保留上下文冗余
- 严禁猜测式赋值，例如 `orderId: id || code`
- 如果需要多源整合，只能在集成点统一做 adapter，不要在业务流中临时拼接

### Builder / Adapter / Integration Point

- 多源字段合并只允许出现在明确的集成点
- 不要在 UI 事件回调里随手拼 payload
- 不要在业务函数内部顺手补一个 fallback 就继续流转
- 如果写日志，优先记录原始字段名与原始值

## Red Lines

- 严禁在核心业务流里散落 `typeof`、`Array.isArray`、深层可选链兜底
- 严禁 `a?.b?.c || default` 这类就地修补继续污染业务逻辑
- 严禁 `sourceA ?? sourceB` 给关键 payload 字段做隐式多源兜底
- 严禁该阻断的错误被静默吞掉，最后返回 `null` / `undefined` 蒙混过关
- 严禁把视图层或业务层当成脏数据清洗场
- 严禁把临时 fallback 当成长期架构方案
- 严禁边界没收好，却让下游每一层都各自判空兜底

## Output Focus

输出或实现建议时，优先覆盖这些点：

1. 边界在哪里
2. 哪些规则属于 `assertXxx`
3. 哪些规则属于 `normalizeXxx`
4. 核心业务流因此移除了哪些防守逻辑
5. UI 输出与 API payload 是否都达到了单一来源与确定性

## Output Checklist

发送前检查：

- 是否明确识别了边界输入来源
- 是否把强规则校验和归一化清洗拆成两类职责
- 是否保留了原字段结构与命名
- 是否把 UI 回退逻辑前置出了视图层
- 是否让关键 payload 字段保持单一来源
- 是否清理了核心业务流中的临时防御代码

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先在业务代码里加几个判空就行”
- “这个字段不稳定，渲染时兜底一下”
- “先 `sourceA ?? sourceB` 顶上，后面再说”
- “返回结构里没用的字段都删掉吧”
- “失败了就返回空对象，别影响流程”
- “这层先随手补一个 fallback，后面谁用谁再判断”

这些都说明边界没有真正收敛，核心业务流仍然在替脏数据擦屁股。
