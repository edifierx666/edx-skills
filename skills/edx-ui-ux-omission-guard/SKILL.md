---
name: edx-ui-ux-omission-guard
description: "Use when the user asks to inspect a concrete interface for missed UX, interaction gaps, 遗漏, or 体验补洞, including a screen that feels drawn but incomplete. Own omission scanning, A/B/C interaction suggestions, and user approval for optional changes. Delegate layout diagnosis and editable-flow implementation to their specialist skills. Not for isolated CSS fixes, save-flow wiring, read-only reports, payload cleaning, or proving a handler fired."
type: workflow
lifecycle: active
---

# UI/UX Omission Guard

只负责界面的遗漏扫描、交互建议和候选改动确认。布局与编辑闭环由专项 skill 维护，本 skill 不再复制其实现规范。

## 入口与依赖

- 用户要求遗漏审查、体验补洞或检查界面是否完整时，运行本流程；仅出现 CSS、表单或保存需求，不自动触发。
- 纯布局修复交给布局专项；纯编辑保存或只读请求竞态交给编辑专项。纯查询、核查、解释只回答结论和证据，不自动补交互或凑五条建议。
- 独立安装本 skill 时，应同时安装下列两个专项；每次只加载命中的专项。优先使用宿主的 Skill 入口，入口不可用时读取链接指向的 `SKILL.md`，相对路径以本文件所在目录为基准。

| 命中问题 | 唯一规则来源 |
|---|---|
| 几何、CSS、滚动、遮挡、热区与焦点 | [edx-layout-blast-radius-guard](../edx-layout-blast-radius-guard/SKILL.md) |
| 编辑、校验、保存反馈与请求竞态 | [edx-editable-flow-closure](../edx-editable-flow-closure/SKILL.md) |

专项不可用时，说明缺少的依赖及影响范围；可继续有证据的遗漏扫描，但暂停依赖该专项的修复，不猜测或重建第二份规范。用户明确只要静态原型时排除保存链路；只读竞态只引用编辑专项的时序规则，不要求保存闭环。

共享引用同步、组件职责、payload 清洗、执行可达性和读取四态分别交给对应专项，本 skill 不接管这些职责。

## 扫描与实施边界

1. 写清文件、组件、用户目标和不改范围；按上表加载所需专项。
2. 读 [遗漏扫描](references/omission-scan.md)，逐项结合当前组件和实际行为判断，不适用就跳过。
3. **必须收口**：用户已要求的链路缺段，或本次改动直接引入、会破坏目标交互的问题。按专项规范修复并验证。
4. **候选询问**：有证据但用户未要求的交互增强。先记录，不实现；只读审查中连必须收口项也仅报告，不修改。
5. 汇总已处理和未验证项，再给交互建议与确认清单。专项已经给出的诊断、修复和验证只引用结论，不重复输出整套模板。

## 交互建议与确认

完整遗漏审查保留两个段落，均基于当前界面，不把扫描表原样当提问：

- **交互建议**按 A/B/C 分组：A 强相关至少 2 条（本次 diff 或同一控件的下一步）；B 弱相关至少 2 条（同页非必经路径）；C 其他补充至少 1 条（相邻流程或整页一致性）。建议可用 `A1`、`B1`、`C1` 标识，写清触发动作和当前行为，不代表已改动。
- **要不要补这些交互**从建议中展开至少 5 条候选，三组都要出现；候选独立使用连续数字 `1`、`2`、`3`，不与建议编号混用。每条写清触发动作、现在会怎样、补上后会怎样、不会改什么。
- 询问用户选择哪些数字编号；未确认前不实现，确认后只做选中的项。候选超过 8 条时优先压缩 C，再压缩 B。
- 不足时继续调查当前组件，不能虚构缺口、机械凑数或把弱相关抬进 A。证据不足则明确报告，不能声称完整扫描通过。

## 交付

- **范围与专项结论**：计划改动、不改范围、采用的专项及其关键结论。
- **遗漏扫描**：必须收口项的证据与处理结果、未命中类别、候选项。
- **验证**：实际检查与结果、未验证项及原因；有修复时包含正常与相关极端场景。
- **交互建议**：按上述 A/B/C 规则输出，不混入“已完成”。
- **要不要补这些交互**：数字编号候选与确认问题，不把候选当作用户已授权需求。

## 红线

- 不在本 skill 或其 references 维护第二套布局、编辑保存或防竞态实现规则。
- 不以遗漏审查为由修改用户明确排除的内容，也不未经确认实现候选交互。
- 不把纯查询或单项专项修复扩成强制的完整 UX 审查。
- 不把未验证、依赖缺失或仅静态展示报告为修复完成。
