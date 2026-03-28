---
name: layout-blast-radius-guard
description: Use when changing CSS, layout, spacing, containers, overlays, or interaction hit areas where blast radius, semantic class boundaries, and rendering side effects must be evaluated before making style changes.
---

# Layout Blast Radius Guard

## Overview

这个 skill 解决的不是“样式怎么写出来”，而是“样式一改会炸到哪里、为什么会炸、该怎么防”。

它把布局和样式改动视为有传播半径的物理系统，而不是一段局部 CSS 文本。

## When to Use

Use when changing layout, CSS, class naming, spacing, container sizing, overlays, scroll behavior, hit areas, or shared styles where visual side effects may propagate beyond the local component.

典型请求：

- “改一下这个样式 / 布局”
- “这个弹层被截断了”
- “这个点击 / 滑动为什么失效”
- “提取一下公共样式”
- “把这几个卡片布局改一下”
- “滚动条没了 / 内容被裁掉了”
- “这个图片显示得不对”
- “改完这个容器后，其他地方也偏了”

Do not use as the primary skill for:

- 纯业务逻辑讲解
- 纯数据清洗和 assert/normalize 问题
- 纯执行可达性审计
- 纯编辑保存闭环问题

优先级规则：

- 主问题是“怎么工作” → `understanding-code-logic`
- 主问题是“组件职责和状态归属” → `business-component-boundary`
- 主问题是“样式改动的物理影响和风控” → 本 skill

## Semantic Class Contract

### 必须使用有业务含义的类名

要求：

- 使用有实际语义的 HTML 类名
- 按卡片、模块、容器层级命名
- 避免把原子类名当语义类名

### SCSS / LESS 必须显式完整类名

要求：

- 强制显式拼写完整类名
- 绝对禁止 `&xxx` 这种导致全局搜索失效的拼接写法
- `&:hover`、`&::before` 这类伪类 / 伪元素组合是允许的

## Blast Radius Protocol

修改任何样式，必须做两类推演：

### 向上看：最近 5 层父容器

必须评估：

- 父容器尺寸是否会被内容反推撑开
- 对齐方式是否会连带变化
- Flex / Grid 分配是否会重新计算
- 是否会触发重排 / 位置偏移
- 是否会影响 overlay、sticky、scroll 区域

### 向下看：内部封装子组件

必须评估：

- 是否污染了子组件默认间距或尺寸
- 是否改变了子组件可点击区域
- 是否让子组件内部 absolute / fixed 定位失真
- 是否影响图片、文本截断、滚动区、下拉层

## Layout Defaults

### 默认优先 Flex / Grid

- 全面采用 Flexbox（首选）与 CSS Grid 布局
- 尽量用流式响应布局
- 优先由内容撑开，而不是预设刚性高度

### 尽量避免写死固定高度

固定高度不是不能用，但它会带来：

- 内容截断
- 弹层被切
- 滚动区域异常
- 响应式失衡

## Red List / Blacklist

### `overflow: hidden`

如无极端必要，严禁默认使用。

典型风险：

- 下拉菜单被截断
- 滚动条丢失
- 阴影 / hover / overlay 被裁掉

### `object-fit`

严禁无脑用于常规图片处理。

要求：

- 优先通过精确 `width / height` 做物理控制
- 不要把裁剪和缩放问题直接推给 `object-fit`

### 默认不加 aria-* 属性

除非存在明确 A11y 要求，不要为了“好像更规范”而无脑增加无意义 DOM 体积。

## Interaction Failure First-Check

当点击 / 滑动事件无效时，第一顺位必须排查：

1. z-index 层级关系
2. `pointer-events` 穿透或覆盖
3. 是否被父容器裁切
4. overlay / mask / absolute 定位元素是否遮住热区

不要一上来怀疑 JS 事件绑定。

## Output Focus

输出或改动建议时，优先覆盖这些点：

1. 类名是否语义化
2. 样式作用域是否可搜索、可追踪
3. 爆炸半径向上 5 层和向下子组件会受什么影响
4. 布局是否应改用 Flex / Grid 或流式方案
5. 是否存在 `overflow: hidden`、`object-fit`、z-index、`pointer-events` 风险

## Output Checklist

发送前检查：

- 是否说明了最近 5 层父容器的风险
- 是否说明了对子组件的污染风险
- 是否避免了非语义类名和 `&xxx` 拼接
- 是否检查了 fixed height / overflow / z-index / pointer-events 问题
- 是否给出更稳的流式布局方案

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先加个 `overflow: hidden` 压一下”
- “图片不对就先上 `object-fit: cover`”
- “点击没反应，先查 JS 回调”
- “这个类名随便起一下，能用就行”
- “公共样式先抽出去，受影响的地方后面再修”

这些都说明你在跳过样式变更的传播半径审查。
