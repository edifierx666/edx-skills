---
description: "物理布局契约。改 CSS、容器、滚动、覆盖层、热区时读取。"
---

# 布局契约

修改前记录作用域、向上路径、向下路径、平面关系、响应式和验证路径。

- 向上：父容器尺寸、overflow、定位上下文、flex/grid 重算、sticky/scroll。边界在更远处就继续追。
- 向下：子组件间距、absolute/fixed、截断、图片、下拉、点击区域。
- 平面：stacking context、z-index、pointer-events、overlay/mask。
- 响应式：窄屏、长文本、空数据、加载态、动态内容。

优先 Flexbox、Grid、流式尺寸。固定高度、`overflow: hidden`、`object-fit`、absolute 可用，但要写明解决的物理问题、可能裁切的区域和替代方案。

- `overflow: hidden`：确认下拉、阴影、sticky、滚动条、焦点环不被裁。裁切放在该裁的层。
- `object-fit`：先写宽高比和裁切意图。不能用它掩盖错误尺寸。
- 固定高度：写明超出后滚动还是截断。
- 类名用业务模块和容器语义。
- 改了焦点、键盘、热区或可见性，就评估可访问性，不要机械加属性。

点击、滑动、下拉失效时按序排查：overlay 与 stacking、z-index 与定位上下文、pointer-events、父容器裁切与滚动、热区尺寸。物理层正常后才转事件可达性。
