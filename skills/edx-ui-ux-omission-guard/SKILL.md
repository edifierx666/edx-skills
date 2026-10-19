---
name: edx-ui-ux-omission-guard
description: "Use when frontend work changes layout, CSS, overlays, hit areas, scrolling, or any editable UI that must save, validate, and close the loop. Also use when the user asks to check missed UX, unknown gaps, 遗漏, 体验补洞, or a screen feels done but was only drawn. Fix required geometry and edit-loop gaps, then ask with at least 5 UX interactions grouped as A strong, B weak, and C other. Not for read-only reports, payload cleaning, or proving a click handler fired."
type: workflow
lifecycle: active
---

# UI/UX Omission Guard

把界面改动当成会漏掉的物理变化和未收口的编辑流。先修必须收口的问题，再靠模型针对这个界面提出用户没点名的 UX，停下来问要不要做。

## 能补什么，不能补什么

清单只是种子，不是上限。必须收口项按契约修完。未点名的交互不要直接写进代码：先给 A/B/C 交互建议，再在「要不要补这些交互」里列出至少 5 条，问用户要哪些。

- **必须收口**：这次改动直接破坏的几何、热区、滚动、焦点，或用户已要求的编辑链路缺段。先改完。
- **询问后再做**：模型补出的未知交互。每条要能单独接受或拒绝。用户没点头就不改。

读 `references/omission-scan.md` 做扫描和提问。布局细节读 `references/layout-contract.md`。编辑闭环读 `references/edit-contract.md`。只读需要的那份。

## 路由

1. 判定主问题：布局、可编辑闭环，或两者。只读查询的旧响应覆盖新数据，只套时序校验，不补五段保存。
2. 用户明确只要静态原型时，只做布局，并写明保存链路被排除。
3. 不接这些活：共享类名全库同步（`edx-change-impact-closure`）、组件职责（`edx-business-component-boundary`）、先看懂流程（`edx-understanding-code-logic`）、payload 清洗（`edx-assert-normalize-boundary`）、点击后请求有没有发出（`edx-reachable-flow-audit`）、读操作四态（`edx-async-state-completeness`）。

## 步骤

1. 写修改边界：文件、选择器、组件；明确不改什么。
2. 布局改动先做物理扫描再选 CSS。向上追到定位上下文、滚动容器、stacking context 的真实边界，不要停在固定层数。
3. 可编辑需求先回答三个问题，答不出不要写界面：谁触发保存、每个 payload 字段来源是否唯一、成功后页面做什么以及快操作会不会覆盖新数据。
4. 跑遗漏扫描，分出必须收口和候选询问项。
5. 实现必须收口项。候选项先不改代码。
6. 必须收口做完后，先写交互建议，再写「要不要补这些交互」。不要只复读扫描表。
7. 用交付格式说明已改内容。用户点名编号后，只做那几条。

## 交付

```md
## 修改边界
- 主问题：布局 / 可编辑闭环 / 两者
- 计划改动：
- 不改范围：

## 物理传播
- 向上 / 向下 / 平面与响应式
- 不适用则写「本次不改几何」

## 编辑闭环
- 触发点 / 编辑态与 payload / 校验 / 时序标记 / 成功与失败收口
- 不适用则写「本次非编辑」

## 遗漏扫描
- 必须收口：项、原因、已改什么
- 未命中：扫过但不适用的类

## 验证
- 正常场景
- 一个极端场景（长内容、窄屏、快操作或失败响应）

## 交互建议
必须收口完成后再写。按相关度分成三组，每组都要有条目。这是建议，不是已经改动的内容。

### A. 强相关
这次 diff 或同一个控件上，用户下一步就会碰到。至少 2 条。

### B. 弱相关
同一页面、但不是这次改动的必经路径。至少 2 条。

### C. 其他补充建议
相邻流程或整页一致性，不挡当前任务。至少 1 条。

每条一行，编号 `A`、`B`、`C`，写清触发动作和现在会怎样。

## 要不要补这些交互
从上面的建议里展开至少 5 条，三组都要出现。每条写清：

- 编号：与交互建议相同，如 `1`
- 交互：用户在什么动作下会碰到
- 现在会怎样
- 补上后会怎样
- 不会改什么

然后问：要做哪些？回复编号即可，例如 `1  2`；都不要就说跳过。未回复前不实现这些条。
```

## 红线

- 不把静态渲染当成可编辑完成。
- 不在失败时关 Drawer / modal，不静默吞错。
- 防竞态只用请求序号一类纯逻辑；不为此加用户没要的 loading 或 disabled。
- 不用 `overflow: hidden`、固定高度或 `object-fit` 掩盖没说清的裁切。
- 不问就实现候选交互。交互建议和「要不要补这些交互」都要有；询问段少于 5 条，或 A/B/C 任一为空，不算完成。
- 不把扫描表原样当提问。每条都要能在当前组件上指出触发动作。
- 不强相关的条目塞进 A。A 只放这次改动直接带出的交互。
