---
name: editable-flow-closure
description: Use when an editable form, editable detail view, modal, drawer, inline-edit table, toggle, or settings flow must support save, submit, update, or autosave with complete feedback instead of static rendering only.
---

# Editable Flow Closure

## Overview

可编辑需求默认不是“把界面画出来”就算完成。

只要用户能修改数据，就应该按完整闭环交付：**展示 -> 交互 -> 校验 -> 提交保存 -> 状态反馈**。

这个 skill 用来阻止“只做静态渲染、不接保存链路、不补反馈收口”的半成品实现。

## When to Use

Use when the main problem is completing an edit-to-save loop.

典型请求：

- “把这个详情页补成可编辑并能保存”
- “这个表单改完后要提交”
- “这个弹窗 / Drawer 编辑后要更新数据”
- “表格行内编辑后要保存并刷新”
- “这个开关改了就要即时提交”
- “先做个可联调的保存占位”
- “这个 modal 里改完后要保存，失败要提示，成功再关闭”
- “这个 autosave 表单要有 loading、校验和保存反馈”

Do not use as the primary skill for:

- 只读详情页
- 搜索 / 筛选 / 查询表单
- 报表、监控、纯展示页面
- 表单看起来没保存，但用户当前只是要证明 submit / handler 不可达
- 用户明确要求只做静态原型、不接保存链路

优先级规则：

- 主问题是“先看懂现有流程” → `understanding-code-logic`
- 主问题是“边界层怎么收口脏输入 / payload” → `assert-normalize-boundary`
- 如果保存链路已存在，只是在清理 payload、判空或 builder，也切到 `assert-normalize-boundary`
- 若当前首要问题是点击后有没有触发提交、请求有没有发出、autosave / blur 是否真的执行，先切给 `reachable-flow-audit`
- 主问题是“编辑动作怎么完成保存闭环” → 本 skill

## Core Rule

只要是编辑型需求，默认交付必须覆盖这五段：

1. **展示当前值**
2. **承接用户修改**
3. **提交前校验**
4. **触发保存 / 更新 / 自动提交**
5. **给出保存后的反馈与状态闭环**

少任何一段，都不是完整交付。

## Pre-Coding Reflection

动手前先回答这三个问题：

- 用户改完后，点击哪个按钮或动作触发保存？
- 提交参数包含哪些字段？每个字段来源是否唯一明确？
- 保存成功后，页面应该发生什么变化？

如果这三个问题答不出来，不要直接开始堆界面代码。

## Required Flow

### 1. Display

- 展示当前详情或默认值
- 区分“服务端原值”和“本地编辑态”
- 不要把只读展示值和提交值混成一个黑盒对象

### 2. Interaction

- 明确谁承接用户输入
- 明确 dirty state / editing state 何时变化
- 需要时提供取消、重置或回填逻辑
- 必要时明确“未保存修改”如何提示

### 3. Validation

- 在提交前做必要校验
- 该阻断的输入直接阻断，不要提交后再猜错因
- 校验规则尽量贴近边界，不要散在多个按钮回调里
- 不要让错误状态只存在于控制台或内部状态而没有用户可感知反馈

### 4. Submit Mechanism

- 明确提交机制：保存按钮、blur/enter 提交、toggle 即时提交，或 autosave
- 提交期间要有 loading 或重复提交控制
- 请求参数应由 builder / adapter 组装，不要直接把视图状态整包乱传
- 如果是即时提交，必须考虑失败后的状态恢复或回滚策略

### 5. Closure

保存后必须同时做到两件事：给出明确反馈，并同步 dirty state、详情数据或 canonical state；只弹提示不算闭环：

- 成功提示或失败提示
- 重置 dirty state
- 刷新详情数据或列表
- 或把本地 canonical state 更新到最新值
- 只有在语义合理时才关闭弹窗 / Drawer

## If The Real API Is Missing

如果真实保存接口还没给出：

- 主动提供基础的 `handleSave` 或等价提交占位
- 可以带 loading 与简单的重复提交保护
- 在合适场景下可加入简单防抖
- 使用 `// TODO: 接入真实的保存接口` 明确占位

重点是先把闭环搭起来，方便后续联调，而不是停在“先画界面”。

## Request And State Separation

- 视图状态和请求参数必须拆开
- 用 builder 函数或 adapter 组装最终 payload
- 核心入参必须来源唯一明确
- 严禁 `orderId: id || code` 这种猜测式赋值
- 不要把“当前 UI 可见状态”直接当“服务端最终提交状态”原样发送

## Red Lines

- 严禁停留在静态渲染，不接保存链路
- 严禁用户能编辑，但没有明确提交机制
- 严禁提交时没有 loading / 重复点击控制
- 严禁成功后没有反馈，也没有状态同步
- 严禁失败后静默吞掉错误，让页面看起来像保存成功
- 严禁把视图状态直接当服务端 payload 原样提交
- 严禁用多源模糊兜底给关键 payload 字段赋值
- 严禁把“用户能点按钮”误当成“已经完成可交付闭环”

## Output Focus

输出或实现建议时，优先覆盖这些点：

1. 哪个交互动作触发提交
2. 本地编辑态如何承接修改
3. 提交前校验放在哪里
4. 保存动作和 payload 如何组装
5. 成功与失败后的收口动作是什么

## Output Checklist

发送前检查：

- 是否覆盖了展示、交互、校验、提交、反馈五段闭环
- 是否明确了保存触发点
- 是否拆开了编辑态与最终 payload
- 是否给了成功 / 失败反馈策略
- 是否说明了保存后的状态同步方式
- 如果是真实 API 缺失，是否给了清晰的 mock save 占位

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先把页面画出来，保存以后再说”
- “先点按钮假装能提交”
- “成功后就改个本地变量，不管服务端状态”
- “提交失败也别提示，免得打断流程”
- “先把整份表单对象都传上去，后面再清理参数”
- “用户改完数据后，界面看起来更新了，就算完成”

这些都说明闭环没有真正完成，只是把编辑入口做出来了。
