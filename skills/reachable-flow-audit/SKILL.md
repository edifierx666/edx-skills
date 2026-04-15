---
name: reachable-flow-audit
description: "Use when verifying whether code actually executes: branch, handler, click callback, hook/effect, route, request, cron, worker, listener, feature flag, guard, or call chain reachability; trigger for 会不会执行, 有没有触发, 请求发没发, handler 走没走, 死代码, 条件可达."
---

# Reachable Flow Audit

## Overview

把“看起来相关的代码”与“真正进入执行流的代码”拆开。

主线结论只允许保留已验证可达的节点；注释、猜测、死代码、游离逻辑、条件分支必须单独隔离说明。

这个 skill 解决的不是“把模块讲明白”，而是把“哪些节点真的会跑、哪些只是看起来相关”这件事做成严格审计，而不是经验判断。

## When to Use

Use when the user wants to verify whether a path, branch, handler, hook, route, task, callback, request path, or runtime branch is actually reachable.

Trigger phrases include:

- reachable / unreachable / dead code / call chain / entry point / guard / feature flag
- handler / callback / effect / hook / route / request / listener / worker / cron
- click not firing / submit not firing / request not sent / branch not hit
- “这段会不会执行” / “有没有触发” / “handler 走没走” / “请求发没发”
- “是不是死代码” / “调用链断在哪” / “这个分支当前配置会不会进”

典型请求：

- “这段代码到底会不会执行”
- “这个 handler / effect 会不会走到”
- “这条调用链哪些节点是真的可达”
- “这个分支在当前配置下会不会触发”
- “这是不是死代码”
- “注释里说会触发，实际真的会跑吗”
- “这个请求有没有真的发出去”
- “这个 cron / 定时任务在当前环境下会不会执行”
- “这个 callback 注册了，但有没有真实执行路径”

Do not use as the primary skill for:

- 先理解模块整体怎么工作
- 完整的 root cause analysis 或修 bug
- 直接写代码或改代码
- architecture planning

优先级规则：

- 主问题是“模块怎么工作” → `understanding-code-logic`
- 主问题是“哪些节点真的会跑” → 本 skill
- 只要第一性问题是“会不会执行 / 有没有入口 / 请求有没有真的发出”，即使场景发生在保存链路或 normalize 流程里，也优先由本 skill 主导
- 若“调用时机 / 是否会被调用”只是为了辅助 payload、adapter、assert/normalize 重构，而主目标不是判定可达性，则不要抢走主导权

## Core Law

**不进入执行流的代码 = 不存在的代码。**

在把任何节点纳入主线结论前，必须完成三步验证。缺一项，就不能进入主线。

## 3-Step Proof

### 1. Entry Point Identification

先准确定位触发源。

常见入口包括但不限于：

- 对外暴露的 API 路由
- DOM 事件绑定
- Cron 定时任务
- CLI 命令入口
- 框架生命周期钩子
- 被外部系统调用的公开接口
- 订阅器 / 事件总线入口
- 后台 worker / queue consumer

如果入口都没确立，就不要声称后续逻辑“会执行”。

### 2. Call Chain Verification

从入口一路验证到目标节点的完整调用链。

要求：

- 调用链必须连续
- 不允许中间出现“应该是”“大概率会走到”这种猜测跳跃
- 不能只因为函数名相似、注释提到、文件放在附近，就默认链路成立
- 不能只凭某个 util / service “看起来像会被用到”就算主线

### 3. Guards Satisfaction

验证沿途所有前置条件在目标运行态下存在真实成立路径。

包括但不限于：

- if / switch 条件
- 权限校验
- feature flag
- 环境变量
- 运行时配置
- 参数前置条件
- 数据状态守卫
- 仅在某平台 / 某构建模式 / 某账户角色下触发的条件

如果守卫过不去，这条链路就不能算主线可达。

## Node Filtering Matrix

### 👻 幻影代码（Comment-Only / Vaporware）

特征：只有注释、TODO、文档描述，没有可执行实体。

处理：

- 强制从主线剔除
- 如果它对架构理解很重要，只能放到补充说明
- 必须标注 `⚠️ [低可信: 仅注释/未实现]`

### 🪦 物理死区（Structurally Dead）

特征：结构性不可达，例如：

- `if (false)` / `if (0)`
- 被常量开关永久短路
- 位于 `return` / `throw` / `break` / `continue` 之后
- 当前明确分析环境下已被移除的逻辑
- 在当前平台 / 当前构建模式下被明确裁掉的分支

处理：

- 立即剪枝
- 不允许为了“完整性”继续留在主线叙述中

### 🧟 孤岛逻辑（Orphaned / Zero-Reference）

特征：函数、类或模块本身存在，但仓库内找不到明确调用。

处理：

- 默认排除
- 只有在它属于 Public API、Controller 挂载点、RPC 暴露接口、IoC / 反射入口等场景时，才允许保留
- 即使保留，也必须隔离到边缘路径，并标注 `🛑 [高风险: 疑似游离接口/缺失内部引用]`
- 同时补上触发方式假设

### 🔀 条件可达（Conditionally Reachable）

特征：静态调用链存在，但是否导通依赖运行时上下文。

处理：

- 可以纳入分析，但不能直接并入默认主线
- 必须补齐三要素：触发主体、前置条件、导通路径
- 如果默认配置下不会触发，必须标注 `⚠️ [条件可达: 缺省配置下不触发]`

## Output Contamination Firewall

不论内部推演多么复杂，最终给用户的主线结论里，绝对禁止混入任何未通过三步验证的猜测节点。

所有存疑、条件苛刻、或依赖假设的分支，都必须物理隔离到：

- 旁支说明
- 风险提示
- 条件分支
- 低可信补充信息

而不是混进主线流程里冒充“正常会执行”。

## Output Format

输出时按这个顺序组织：

1. **核心判定**：先说“可达 / 不可达 / 条件可达 / 证据不足”
2. **已确认主链**：只放通过三步验证的节点
3. **被剔除节点**：按幻影代码 / 死区 / 孤岛逻辑分类说明
4. **条件分支与风险点**：列出触发主体、前置条件、导通方式
5. **证据锚点**：必要时再给 `file_path:line_number`

先给判定，再给证据。不要一上来堆路径。

## Red Lines

- 严禁把未验证节点混进主线
- 严禁把注释、TODO、文档描述当作执行证据
- 严禁因为“名字像”“目录像”“职责像”就默认有调用关系
- 严禁使用“应该会走到”“大概率如此”但不给降级标注
- 严禁把“条件可达”写成“默认主线可达”
- 严禁为了照顾叙述完整性，把明显已死分支留在主流程里

## Output Checklist

发送前检查：

- 主线里的每个节点是否都有入口、调用链、守卫三类依据
- 每个被剔除节点是否都说明了剔除原因
- 条件分支是否都写清了触发主体、前置条件、导通路径
- 主线结论里是否彻底清除了猜测和补脑
- 如果用户后续想看整体业务流，是否明确建议切换到 `understanding-code-logic`

## Failure Modes To Block

遇到这些输出倾向，要主动拦住：

- “这个文件里有相关代码，所以应该会执行”
- “注释写了这里会触发”
- “先把所有相关分支都算进来再说”
- “虽然现在条件不满足，但也当作主链的一部分”
- “仓库里搜不到调用，但我觉得它像对外入口”
- “模块里有这段逻辑，所以用户操作后大概率会走到这里”

这些都说明你正在把不可信节点污染进主线结论。
