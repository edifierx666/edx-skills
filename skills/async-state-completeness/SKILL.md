---
name: async-state-completeness
description: "Use when building or reviewing any view that renders async data — list, detail, chart, dashboard, search result — and loading/error/empty/success states must all be handled; trigger for 白屏, 空态, 接口失败没提示, NaN, 骨架屏, 四态, 数据没回来页面裂开, 刷新闪一下空页面."
---

# Async State Completeness

## Overview

这个 skill 把守的是**读操作的状态完备性**：每一个异步数据源，页面都必须回答四个问题——加载中长什么样、失败了长什么样、回来是空的长什么样、回来是残缺的长什么样。

写操作的保存反馈闭环由 `editable-flow-closure` 把守；本 skill 管的是它的对偶面：数据**读回来之后**页面的每个分支是否都有着落。逻辑缺口最常见的形态就是只写"数据正常回来"的渲染分支，其余三态全部靠浏览器裸奔。

## When to Use

Use when the main problem is whether an async-data view handles all of its states.

Trigger phrases include:

- loading / skeleton / empty state / error state / fallback UI / partial data
- blank screen / white screen / NaN / undefined rendered / flash of empty
- “白屏” / “空态” / “接口失败没提示” / “骨架屏” / “数据没回来页面裂开”
- “刷新时闪一下空页面” / “列表为空什么都不显示” / “图表数据缺一半”

典型请求：

- “做一个列表页 / 详情页 / 图表页”（任何渲染接口数据的新页面，默认触发）
- “接口失败的时候页面白屏了”
- “这个列表为空的时候什么都没有”
- “数据还没回来就渲染出 NaN / undefined 了”
- “review 一下这个页面的数据渲染”
- “刷新的时候页面闪了一下空状态”

Do not use as the primary skill for:

- 写操作的保存反馈与防竞态（→ `editable-flow-closure`）
- 字段是否真实存在的契约问题（→ `api-field-contract-guard`）
- 脏值如何收敛、默认值放哪一层（→ `assert-normalize-boundary`）
- 纯样式布局问题（→ `layout-blast-radius-guard`）

优先级规则：

- 字段存在性未确认 → 先走 `api-field-contract-guard`；本 skill 只在契约已确认后回答“这个分支渲染什么”
- 空值 / 脏值的收敛动作放在边界层 → `assert-normalize-boundary`；本 skill 负责“归一化之后 UI 到底有没有对应分支”
- 快速操作导致旧响应覆盖新数据 → `editable-flow-closure` 的时序校验；本 skill 不重复管竞态
- 新建任何渲染接口数据的页面时，本 skill 与 `editable-flow-closure`（若含写操作）可同时触发，各管读写两侧

## Core Rule

**每个异步数据源必须显式回答四态：**

1. **Loading**：首次加载渲染什么（骨架屏 / 占位 / 空白均可，但必须是决策而不是缺省）
2. **Error**：请求失败用户看到什么、能不能重试
3. **Empty**：请求成功但数据为空，显示什么
4. **Success / Partial**：数据完整时渲染什么；数据残缺（字段为 null、数组比预期短、分页 total 缺失）时哪些区块降级、哪些照常

答不出任何一态，就是逻辑缺口，不是"以后再补的细节"。

## State Discrimination Law

### 区分"还没回来"和"回来是空的"

- 初始值用 `null` / `undefined` 表示"未加载"，接口返回的空数组 / 空对象表示"已加载但为空"
- 严禁用 `[]` 同时充当两种含义——那会让页面无法区分 loading 和 empty，典型症状就是"刷新闪一下空态"

### 分支判定顺序固定

```text
loading → error → empty → success
```

顺序写错的典型事故：error 时 data 还是初始空值，先判 empty 就会把"接口挂了"渲染成"暂无数据"，用户以为真的没数据。

### 区分首次加载与刷新

- 首次加载：无旧数据，展示 loading 态
- 刷新 / 重新请求：已有旧数据时，默认保留旧数据 + 轻量指示，不要清空重来造成整页闪烁
- 如果产品要求刷新时清空，那是决策；默认行为不能是"顺手 setData(null)"

## Partial Data Protocol

数据回来但不完整时：

- 数值参与计算前必须确认非 null，否则 NaN 会沿着派生链污染整棵渲染树
- 列表项内的可空字段，降级策略要落在单项渲染处，而不是整个列表崩掉
- 图表数据缺失的时间点 / 序列，明确是断线、补零还是跳过——这是业务决策，必须显式
- 降级值（`'-'`、占位图）由边界层 adapter 给出（遵循 `assert-normalize-boundary`），UI 只消费确定值；但**每个区块有没有降级分支**由本 skill 检查

## Error State Requirements

- 失败必须用户可感知：错误提示、错误态区块或重试入口，三者至少其一
- 严禁只 `console.error` 然后页面维持 loading 态永远转圈
- 多数据源页面（如仪表盘）：单个源失败只降级对应区块，不要让一个接口失败拖垮整页
- 重试入口要真的重新发起请求，而不是只把错误提示关掉

## Red Lines

- 严禁只实现 success 分支就宣称页面完成
- 严禁 loading / empty 共用同一个初始空数组，导致状态不可区分
- 严禁接口失败后页面停留在永久 loading 或静默白屏
- 严禁未判空的数值直接进入计算或格式化，让 NaN / `undefined` 渲染到界面
- 严禁刷新时无理由清空旧数据造成闪屏
- 严禁把"空数据"渲染成崩溃或空白，而不是明确的空态
- 严禁在用户没有要求的情况下擅自发明复杂的错误 UI——没有设计稿时用最朴素的文案提示即可，先保证分支存在

## Output Focus

输出或实现建议时，优先覆盖：

1. 这个视图有几个异步数据源，每个数据源的四态分别渲染什么
2. loading 与 empty 如何区分（初始值设计）
3. 失败时用户看到什么、如何重试
4. 数据残缺时哪些区块降级、哪些照常
5. 首次加载与刷新的行为差异

## Output Checklist

发送前检查：

- 是否每个异步数据源都覆盖了 loading / error / empty / success 四态
- 是否用初始值区分了"未加载"与"已加载为空"
- 分支判定顺序是否为 loading → error → empty → success
- 失败态是否用户可感知且可恢复
- 数值计算是否防住了 NaN 传播
- 刷新时是否保留旧数据避免闪屏

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先把正常数据渲染出来，异常情况以后再说”
- “初始值给个空数组，反正数据回来会覆盖”
- “接口失败就 console 打个日志，不影响页面”
- “字段基本都有值，不用管 null”
- “空态就让它空着，用户看得懂”
- “刷新就重置整个状态，简单”

这些都说明读操作的状态分支没有真正闭环。
