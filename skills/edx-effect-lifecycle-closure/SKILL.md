---
name: edx-effect-lifecycle-closure
description: "Use when code registers side effects that outlive a render or call — timers, polling, event listeners, WebSocket/subscriptions, observers, debounce handles, AbortController — and every registration must have a paired cleanup; trigger for 内存泄漏, 组件卸载后 setState, 轮询没停, 监听没移除, 重复订阅, 定时器越跑越多."
---

# Effect Lifecycle Closure

## Overview

这个 skill 把守**副作用的注册与清理配对**：每一个"注册"动作（定时器、监听器、订阅、轮询、观察器），都必须指得出对应的"清理"动作和清理时机。指不出，就是缺口。

这类缺口的特点是**当下看不出任何问题**：页面功能正常、测试通过，直到用户来回切了十次路由，后台挂着十个轮询、内存里躺着十份监听器。它是排查成本最高的一类慢性 bug，所以必须在写的时候闭环，而不是等泄漏了再查。

## When to Use

Use when the main problem is whether registered side effects are properly cleaned up.

Trigger phrases include:

- timer / interval / polling / event listener / subscription / WebSocket / observer
- memory leak / cleanup / unmount / dispose / unsubscribe / removeEventListener
- setState after unmount / duplicate subscription / stale closure
- “内存泄漏” / “轮询没停” / “监听没移除” / “重复订阅”
- “组件卸载了还在 setState” / “定时器越跑越多” / “切页面后还在请求”

典型请求：

- “加一个轮询 / 定时刷新”
- “监听一下 resize / scroll / 键盘事件”
- “接一个 WebSocket / SSE / 消息订阅”
- “页面切走之后接口还在请求”
- “控制台报 setState on unmounted component”
- “来回切 Tab 后页面越来越卡”
- “review 一下这个 hook 的副作用”

边界与分流规则：

- 第一性问题是“这个 effect 到底会不会执行” → 先走 `edx-reachable-flow-audit`；本 skill 只在确认会执行后检查“执行之后能不能收回来”
- 副作用放哪一层是组件设计问题 → `edx-business-component-boundary`；本 skill 不管归属，只管“放在哪都必须配对清理”
- 旧响应覆盖新数据是时序问题 → `edx-editable-flow-closure`；但“组件卸载后回调仍然执行”属于本 skill 的清理缺口
- 数据回来后的 loading / error / empty / 残缺四态渲染 → `edx-async-state-completeness`；本 skill 只管副作用能否收回，不管渲染态

## Core Rule

**注册与清理必须配对，且写在同一个视野内。**

每个副作用注册点，必须能当场回答三个问题：

1. **清理动作是什么**：`clearInterval` / `removeEventListener` / `unsubscribe` / `disconnect` / `abort`
2. **清理时机是什么**：组件卸载、依赖变化重建、页面隐藏、任务完成、条件不再满足
3. **重复注册如何防**：依赖变化时是先清后建，还是幂等注册

任何一问答不出，就不允许把这段副作用代码当作完成。

## Pairing Table

| 注册 | 必须配对的清理 |
| --- | --- |
| `setTimeout` / `setInterval` | `clearTimeout` / `clearInterval`，句柄必须留存 |
| `addEventListener` | `removeEventListener`，且必须是**同一个函数引用** |
| WebSocket / SSE / 消息订阅 | `close` / `unsubscribe`，含错误分支中的关闭 |
| `IntersectionObserver` / `ResizeObserver` / `MutationObserver` | `disconnect` / `unobserve` |
| 轮询循环（递归 setTimeout / interval） | 停止标记或句柄清除，且页面隐藏时暂停策略要显式决策 |
| debounce / throttle 句柄 | `cancel`（组件卸载时挂起的延迟调用必须取消） |
| 进行中的请求回调 | 卸载标记或 `AbortController`，防止回调落在已卸载组件上 |
| store / event bus 上的监听 | 对应的 off / 取消注册，严禁只注册不注销 |

## Framework Contract

### React

- `useEffect` 内注册的副作用，**必须**在返回的 cleanup 函数中清理
- 依赖数组变化会先执行 cleanup 再重建——利用这一点做“先清后建”，而不是在 effect 体内自己判断去重
- 事件处理函数如需稳定引用，用 `useCallback` 或 ref 保存，确保 remove 时拿到的是注册时的同一个引用
- 异步回调更新状态前，检查卸载标记或使用 AbortController

### Vue

- `onMounted` 注册的，必须在 `onUnmounted` / `onBeforeUnmount` 清理
- `watch` / `watchEffect` 返回的 stop 句柄，手动创建的场景要保存并在适当时机调用
- 组件外创建的全局监听（如挂在 `window` 上），必须随组件生命周期同步注销

### 通用

- 模块级 / 单例注册的副作用（全局事件总线、全局定时器），要指明"整个应用生命周期存活"是显式决策，并说明为何不需要清理
- 清理函数必须幂等：重复调用不报错

## Duplicate Registration Guard

依赖变化或重复进入时的防重复策略必须显式：

- effect 重建型：依赖变化 → cleanup 旧的 → 注册新的（框架保证顺序，代码只需正确写 cleanup）
- 条件注册型：注册前检查是否已存在，或先无条件清理再注册
- 严禁"再进来一次就再挂一个监听"——症状是事件触发一次、handler 跑 N 次

## Red Lines

- 严禁注册定时器 / 监听器 / 订阅而不保存清理所需的句柄或引用
- 严禁 `removeEventListener` 传入与注册时不同的函数引用（等于没移除）
- 严禁 `useEffect` 里有注册动作却不返回 cleanup 函数
- 严禁异步回调不经卸载检查直接 setState / 更新已销毁的实例
- 严禁轮询只写启动逻辑，不写停止条件
- 严禁在错误分支提前 return 而跳过了本应执行的清理
- 严禁把"反正页面不常切"当作不写清理的理由

## Output Focus

输出或实现建议时，优先覆盖：

1. 本次代码注册了哪些副作用（逐个列出）
2. 每个副作用的清理动作、清理时机、防重复策略
3. 哪些副作用是显式决策不清理的（如应用级单例），理由是什么
4. 异步回调是否防住了卸载后执行

## Output Checklist

发送前检查：

- 是否每个注册点都有配对的清理点，且写在同一视野内
- removeEventListener 的函数引用是否与注册时一致
- 依赖变化时是否先清后建，防住重复注册
- 异步回调是否检查了卸载标记或使用了 AbortController
- 轮询是否有明确的停止条件
- 不清理的副作用是否有显式说明

## Failure Modes To Block

遇到这些倾向，要主动拦住：

- “先把轮询跑起来，停止逻辑以后再加”
- “监听挂在 window 上无所谓，反正就一个页面”
- “setState 报 warning 而已，不影响功能”
- “remove 的时候重新写一个箭头函数就行”
- “这个 effect 依赖不会变，不用写 cleanup”
- “订阅了没取消，反正组件很少销毁”

这些都说明副作用只有"开"没有"关"，生命周期没有闭环。
