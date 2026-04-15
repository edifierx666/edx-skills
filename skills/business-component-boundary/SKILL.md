---
name: business-component-boundary
description: "Use when frontend work touches component splitting, page-local vs shared components, props drilling, shared state, store ownership, hooks, side effects, event bus, strategy patterns, or questions like 组件该不该抽出去, 状态放哪, 业务组件还是通用组件, 深层组件怎么解耦, 大 switch 拆不拆."
---

# Business Component Boundary

## Overview

这个 skill 解决的不是“组件能不能拆”，而是“该拆成什么、状态该放哪、职责该收在哪一层”。

核心目标是降低心智负担：

- 默认优先业务组件，而不是过早抽通用组件
- 默认优先把复杂状态和副作用收拢，而不是分散到多个组件里
- 默认优先用清晰边界解决耦合，而不是加一层又一层空转中介

## When to Use

Use when building or refactoring pages, modules, components, stores, or interaction flows where component responsibility, state ownership, and decoupling boundaries are the main architectural questions.

Trigger phrases include:

- component boundary / component responsibility / state ownership
- split component / extract component / shared component / business component
- props drilling / lifting state / local state / global store / domain store
- event bus / observer / strategy pattern / decouple nested components
- “组件怎么拆” / “组件该不该抽出去” / “业务组件还是通用组件”
- “状态放本地还是 store” / “多个组件都在管状态” / “深层组件怎么解耦”

典型请求：

- “这个组件该不该抽出去”
- “这是业务组件还是通用组件”
- “这块状态该放本地还是全局 store”
- “多个组件都在管同一份状态，怎么收敛”
- “这个大 switch / if-else 能不能拆掉”
- “深层组件之间怎么解耦”
- “这个模块拆完后职责边界还是很乱”
- “要不要上观察者模式 / 策略模式”

Do not use as the primary skill for:

- 纯讲代码逻辑和现状阅读
- 纯样式布局问题
- 纯数据边界清洗与 assert/normalize 收口
- 纯编辑保存闭环问题

优先级规则：

- 主问题是“先理解现状怎么工作” → `understanding-code-logic`
- 主问题是“脏输入怎么在边界收口” → `assert-normalize-boundary`
- 主问题是“编辑交互怎么形成保存闭环” → `editable-flow-closure`
- 主问题是“组件职责、状态归属、解耦边界怎么定” → 本 skill

## Core Philosophy

### 1. 默认优先业务组件

默认将组件定位为“为拆解复杂业务而生”。

这意味着：

- 组件优先放在所属页面或业务模块附近
- 不要先假设它是一个通用 UI primitive
- 如果它需要自己管理请求、状态、事件和副作用，这通常是正常的业务组件，不是坏味道

### 2. 通用组件必须显式成立

只有在被明确要求“开发通用 / 基础 UI 组件”时，才采用重 Props / Events 驱动的 dumb component 设计。

也就是说：

- 通用组件不是默认答案
- “以后可能复用”不构成抽通用组件的充分理由
- 复用性必须真实存在，而不是想象出来的

### 3. 状态必须收敛

全局共享数据与高频跨组件副作用必须收拢到统一的 Store。

要求：

- 按业务领域划分子模块
- 边界清晰，可替换
- UI 组件只负责渲染与意图分发，不负责长期持有共享业务状态
- 如非必要，禁止多个组件各自维护一份彼此耦合的状态逻辑

### 4. 视图层必须纯粹

视图组件要尽量保持干净：

- 展示数据
- 分发用户意图
- 不在多个层级重复持有同一份业务状态
- 不在深层组件里散落复杂副作用

## Component Classification Protocol

在决定组件边界时，先判断它属于哪一类：

### A. 页面内业务组件

特征：

- 强依赖当前页面或模块语义
- 自己管理局部请求或局部业务状态
- 很难脱离当前业务上下文复用
- 真正的职责是拆解业务复杂度，而不是抽象视觉外壳

默认处理：

- 就近创建
- 可以拥有内部状态与内部请求
- 不为了“看起来更通用”而提前抽公共目录

### B. 通用组件 / 基础 UI 组件

特征：

- 与具体业务语义弱相关
- 输入输出边界稳定
- 通过 Props / Events 就足以表达职责
- 被多个业务域真实复用

默认处理：

- 显式声明为通用组件
- 采用 dumb component 设计
- 不要偷偷内嵌业务请求或业务状态

### C. Store / Domain State

特征：

- 跨组件共享
- 更新频繁且会触发多个视图或副作用
- 有明确业务领域归属

默认处理：

- 收拢至统一 store
- 按领域切模块
- 不要拆成多个组件私有状态再通过 props 链接缝合

## Decoupling Patterns

### 发布订阅 / 观察者模式

适用：

- 跨越深层组件的事件驱动
- 多端 / 多模块并发触发同一函数
- 不想通过多层 props 透传事件

使用目标：

- 解耦触发方与消费方
- 让深层组件不依赖彼此实现细节

### 策略模式

适用：

- 不同上下文下分发不同算法或行为
- 大量 switch/case 或 if/else 已经臃肿

使用目标：

- 把“不同情景下行为不同”从一大坨条件分支里拆出来
- 保持主流程稳定，变的是策略，而不是主干

## Law of Demeter

只暴露最核心的必要接口，严格隐藏内部实现细节。

常见错误：

- 外层组件知道内层组件太多实现细节
- 页面直接操纵深层子组件内部状态
- 为了完成一个动作，调用方必须理解一长串中间层协议

目标：

- 外部调用者只知道必要入口
- 内部实现怎么运转，对外尽量不可见

## Red Lines

- 严禁把“以后可能复用”当作提前抽公共组件的理由
- 严禁多个组件分散维护同一业务状态，再靠 props / watch / effect 缝起来
- 严禁为了“解耦”增加无效中介和空转映射
- 严禁大组件拆成一堆视觉上小、职责上更乱的壳组件
- 严禁在通用组件里偷偷写业务请求和业务状态
- 严禁把策略问题继续塞进巨大 switch / if-else

## Output Focus

输出或设计建议时，优先覆盖这些点：

1. 这是业务组件还是通用组件
2. 状态应该放本地、Store 还是事件边界
3. 哪些副作用应该收拢，哪些应该下放
4. 是否需要观察者模式或策略模式来解耦
5. 外部接口最小应该暴露到什么程度

## Output Checklist

发送前检查：

- 是否明确分类了组件类型
- 是否明确了状态归属
- 是否避免了过早抽象和空转中介
- 是否保证了视图层纯粹
- 是否给出了清晰的解耦模式选择理由

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先抽成公共组件，后面应该能复用”
- “每个组件自己管一点状态，最后再同步”
- “加个中间层适配一下，虽然现在什么都没简化”
- “先上一个超大通用组件，后面通过 props 配平差异”
- “这个 switch 先留着，以后复杂了再拆策略”

这些都说明组件边界还没有真的收敛。
