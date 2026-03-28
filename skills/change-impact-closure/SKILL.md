---
name: change-impact-closure
description: Use when changing shared code, schemas, stores, payloads, utilities, contracts, or base abstractions where upstream and downstream impact must be traced and closed across the full chain.
---

# Change Impact Closure

## Overview

这个 skill 解决的不是“这一处怎么改”，而是“改完这一处后，整条链还剩哪些地方必须一起收口”。

它适用于所有会引发上下游联动的修改：底层 util、数据结构、Store 字段、请求参数、共享组件、公共样式、契约字段、接口约定。

## When to Use

Use when modifying a shared or foundational element whose effects may propagate through upstream and downstream consumers.

典型请求：

- “改一下这个底层数据结构”
- “把这个字段名换掉”
- “调整一下共享 util / helper / builder”
- “Store 里这个字段要重构”
- “这个 API 契约变了”
- “抽一下公共能力 / 公共样式”
- “这个基础组件的入参改了”
- “我想改这层，但别影响上层”

Do not use as the primary skill for:

- 纯局部小改，且无明显上下游联动
- 纯样式物理布局问题
- 纯执行可达性判断
- 纯边界清洗与 assert/normalize 收口

优先级规则：

- 主问题是“怎么工作” → `understanding-code-logic`
- 主问题是“有没有执行 / 哪些节点真的会跑” → `reachable-flow-audit`
- 主问题是“边界层如何收口脏输入” → `assert-normalize-boundary`
- 主问题是“改一个共享点后，上下游谁必须一起收口” → 本 skill

## Core Principles

### 1. 修改边界必须明确

任何改动前，必须先说清两件事：

1. 计划修改的范围：会改哪些文件、哪些主要逻辑
2. 不会改的范围：本次绝不碰哪些文件、模块、核心功能

这不是汇报格式问题，而是防跑偏的边界控制。

### 2. 闭环更新机制

只要改了底层代码或数据结构，就必须全链路追踪并同步更新所有关联模块。

严禁出现：

- 改了底层，忘了上层
- 改了 schema，没改 builder / adapter / consumer
- 改了 store 字段，没改 selectors / views / payload
- 改了基础组件入参，没改调用方

### 3. 单一事实来源

同一概念只允许一个稳定事实来源。

要求：

- 消除魔法字符串与魔法数字
- 同文件重复值要提常量或枚举
- 共享契约不允许每层自己解释一遍

## Impact Scan Protocol

在动手改共享点前，至少扫描这几类影响面：

### A. Upstream 输入侧

- 谁在构造它
- 谁在写入它
- 谁依赖旧字段 / 旧签名 / 旧协议

### B. Downstream 消费侧

- 谁在读取它
- 谁在展示它
- 谁在把它继续组装成下一跳 payload
- 谁会因为字段变化而出现隐式断裂

### C. Side Effects / Integration

- 日志 / 埋点
- 缓存 key
- 派生计算
- 权限判断
- 事件分发
- 样式钩子 / 类名依赖

## Change Categories

### 数据结构 / 契约变更

重点检查：

- 字段名
- 字段含义
- 可空性
- 默认值
- payload 构造路径
- 接口 consumer

### 共享 util / helper 变更

重点检查：

- 输入签名
- 返回结构
- 调用方数量
- 是否有项目内既有复用点
- 是否会把旧逻辑 silently 改坏

### Store / 状态模型变更

重点检查：

- selectors
- watchers / effects
- UI 展示层
- 提交参数
- 派生计算

### 公共组件 / 样式变更

重点检查：

- 上层调用方式
- 默认值与兼容语义
- 布局爆炸半径
- 下游封装子组件

## Required Output Structure

输出时优先覆盖这些点：

1. 改动范围
2. 明确不会改的范围
3. 哪些上下游节点必须同步更新
4. 哪些地方最容易出现链路断裂
5. 如何确认本次改动形成了闭环收口

## Red Lines

- 严禁只改底层，不追踪上层 consumer
- 严禁字段改名后，让旧名字在链路中半死不活地残留
- 严禁共享 util 改签名却不看全局调用点
- 严禁为了局部方便，制造第二事实来源
- 严禁“这次先改底层，上层以后再修”

## Output Checklist

发送前检查：

- 是否明确了会改 / 不会改范围
- 是否列出了上下游必须同步更新的点
- 是否检查了日志、缓存、派生值、权限、事件等隐性依赖
- 是否避免了第二事实来源和链路断裂
- 是否真正形成了变更闭环

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先把底层字段改了，页面报错再补”
- “这个 util 应该没几处用，先改了再说”
- “旧字段先留着，新字段也加着，后面慢慢清”
- “调用方太多，这次先不全追”
- “这只是一个小改动，应该不会影响别处”

这些都说明你还没有真正做影响闭环审查。
