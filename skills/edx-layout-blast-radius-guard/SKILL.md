---
name: edx-layout-blast-radius-guard
description: "Use when frontend work changes CSS or physical layout—spacing, flex/grid, responsive containers, overflow, scroll, z-index, overlays, masks, hit areas, images, class names, or shared styles—or when symptoms include clipped overlays, broken clicks, lost scrolling, overflow, or a container change affecting other views. Trace the affected geometry and consumers before choosing a CSS fix."
---

# Layout Blast Radius Guard

## Purpose and boundary

把布局改动当成会传播的物理变化，而不是一行局部 CSS。先定位受影响的几何关系，再决定修复方式；共享类名的引用同步属于 `change-impact-closure`，组件职责属于 `business-component-boundary`。

适用于布局、CSS、容器尺寸、响应式、滚动、覆盖层、点击热区、图片尺寸和共享样式。纯业务逻辑、数据清洗、执行可达性和编辑保存分别交给对应 Skill。

## Physical scan

每次修改前记录：

- **作用域**：文件、选择器、组件和页面引用；
- **向上路径**：至少检查最近 5 层父容器的尺寸约束、overflow、定位上下文、flex/grid 重算、sticky/scroll 关系；
- **向下路径**：检查子组件的默认间距、absolute/fixed 定位、文本截断、图片、下拉层和点击区域；
- **平面关系**：检查 stacking context、z-index、pointer-events、overlay/mask 是否遮挡或穿透；
- **响应式**：窄屏、长文本、空数据、加载态和动态内容是否改变几何；
- **验证路径**：列出至少一个正常尺寸和一个极端尺寸/交互场景。

不要把“最近 5 层”当成机械数字：如果定位上下文、滚动容器或 stacking context 在更远处，继续追到物理边界。

## Stable layout defaults

优先采用可解释的 Flexbox、CSS Grid 和流式尺寸。固定高度、`overflow: hidden`、`object-fit`、absolute 定位不是绝对禁用项，但每次使用都要写明它解决的物理问题、可能裁切的区域和替代方案。

- `overflow: hidden`：确认下拉、阴影、sticky、滚动条和焦点环不被裁切；必要时把裁切边界移到真正应裁切的层。
- `object-fit`：先说明图片容器的宽高比和裁切意图，再选择 `contain`、`cover` 或不裁切；不能用它掩盖错误尺寸。
- 固定高度：说明内容超出时的滚动或截断策略，并覆盖长文本和响应式场景。
- 语义类名：使用业务模块和容器语义，避免不可搜索的原子命名；SCSS/LESS 允许 `&:hover`、`&::before`，但嵌套选择器必须仍能明确定位完整语义。
- A11y：不要机械添加属性；但如果改变焦点、键盘操作、热区或可见性，必须同步评估对应可访问性行为。

## Interaction-first diagnosis

点击、滑动或下拉失效时，按物理链路排查：

1. overlay/mask 与 stacking context；
2. z-index 和定位上下文；
3. `pointer-events` 覆盖或穿透；
4. 父容器裁切与滚动区域；
5. 热区尺寸及响应式覆盖；
6. 物理层确认正常后，才转给事件可达性或业务逻辑审查。

## Required output

```md
## 修改边界
- 计划改动：文件、选择器、组件、主要几何逻辑
- 不改范围：业务逻辑、共享契约或明确排除项

## 物理传播
- 向上：父容器和定位/滚动上下文
- 向下：子组件和内部热区
- 平面/响应式：遮挡、裁切、窄屏、长内容

## 修复与验证
- 选择的 CSS 方案及其物理原因
- 保留的风险与替代方案
- 正常与极端场景的验证步骤
```

## Completion checklist

- 修改选择器和所有相关引用范围已确认；
- 父容器、子组件、stacking context、overflow、scroll 和 hit area 的物理影响已记录；
- 至少覆盖长内容、窄屏或动态内容中的一个极端场景；
- 每个固定尺寸、裁切或覆盖方案都有明确理由；
- 共享引用同步交给 `change-impact-closure`，代码执行问题没有被 CSS 假设掩盖；
- 修复后有可复现的视觉/交互验证路径。
