---
name: inline-code-annotation
description: Use when writing, explaining, reviewing, or refactoring code — annotate key variables, fields, states, and non-obvious values inline with "// ←" so every reader (including future you) can understand the code at a glance without chasing definitions.
---

# Inline Code Annotation

## Overview

代码里的变量名能传达"叫什么"，但往往传达不了"为什么是这个值"、"这个字段在业务上意味着什么"、"这个状态被谁消费"。`// ←` 标注解决的就是这个问题——在关键位置用最短的一句话补上业务含义，让任何读者（包括三个月后的你）不用跳转、不用猜。

这不是"写注释"，而是"把隐式知识钉在代码旁边"。

## When to Use

**三档触发层级：**

| 层级 | 场景 | 触发条件 |
|------|------|---------|
| **L1 强制** | 写新增代码 | 任何新增文件 / 函数 / 组件 / 逻辑块，关键变量必须标注 |
| **L2 强制** | 分析 / 解释代码 | 用户要求"分析这段代码""这个模块怎么工作的"，贴出的代码片段关键变量必须标注 |
| **L3 强制** | 复杂业务逻辑 | 涉及多状态流转、payload 组装、接口字段映射、非显而易见的计算 |

同时满足以下条件时也应该触发：

- code review 中发现变量含义不明确
- 重构代码，旧注释失效需要补标注
- 用户说"这段看不懂""这个字段是什么意思"

**典型请求：**

- "帮我写一个 XX 功能"
- "分析一下这个模块"
- "这段代码在干什么"
- "review 一下这个 PR"
- "重构这块逻辑"

## Core Principle

**关键变量必须标注，次要变量推荐标注，自解释变量不标注。**

标注回答的不是"这个变量叫什么"（名称已经回答了），而是：
- 这个值从哪来（接口 A 的 field_x？用户选择？计算派生？）
- 这个值到哪去（最终发给后端？驱动 UI 显隐？传给子组件？）
- 这个值的业务含义（不是技术含义）

## Red Lines

- 新增代码中的关键变量、状态、字段，**必须**逐行 `// ←` 标注，不得遗漏
- 标注**一律放在行尾**（`// ←` 紧跟被标注的变量/字段所在行），不得另起一行、不得放在上方、不得放在下方
- 分析代码时贴出的代码片段，**必须**标注后再呈现给用户
- 标注内容必须是**大白话业务含义**，不得用技术术语重复变量名
- 严禁把多个字段合并成一句模糊说明
- 严禁用"同上""类似"跳过标注
- 不得在标注中写"用于 XX 功能""供 XX 调用"——标注回答的是**数据含义**，不是**调用关系**

## 什么是"关键变量"（必须标注）

满足以下**任意一条**即为关键变量：

1. **状态变量**：`useState`、`ref`、`useRef`、store 中的状态、context 中的值
2. **接口返回字段**：API 响应中进入渲染链路的字段
3. **Payload / 提交字段**：最终发给后端的参数对象中的字段
4. **派生 / 计算值**：`useMemo`、`computed`、派生变量，尤其是跨多个上游来源的计算
5. **业务常量 / 枚举 / 配置**：其值本身不直观，需要业务知识才能理解
6. **函数参数**：非自解释的参数（如 `id` 自解释，但 `source: number` 需要标注来源类型）
7. **条件分支的判断变量**：`if (flag)` 中的 `flag`，如果它的含义不是一眼能看出的
8. **回调 / handler 函数**：它被谁触发、触发后产生什么副作用

## 什么是"次要变量"（推荐标注）

1. 循环索引 `i`, `j`, `index`
2. 临时解构且名称与来源完全一致（如 `const { name, age } = user`，`user` 已标注）
3. 框架模式变量且用法是标准惯例（如 `setState` 来自 `useState`、`navigate` 来自路由 hook）
4. 一眼能看出含义且作用域不超过 5 行的局部变量

次要变量如果存在歧义（比如 `index` 既可能是循环索引也可能是业务索引 id），则升级为关键变量，必须标注。

## 标注格式

**基本格式：**

```ts
const variableName = someValue; // ← 大白话业务含义
```

**标注位置（一律行尾）：**
- 声明语句：行尾 `// ←`
- 对象字段：字段行尾 `// ←`
- 解构赋值：拆成每行一个变量，各自行尾 `// ←`
- 函数参数：每个参数独占一行，行尾 `// ←`
- TypeScript interface / type 字段：字段行尾 `// ←`
- 严禁将标注放在被标注行的上方或下方独立一行

**标注内容要求：**
- 一句话说清，不超过 30 个字
- 用大白话，不用术语（说"用户选中的时间范围"而不是"timeRange 状态"）
- 如果变量来自接口，标注 `[接口名]` 引用（如 `// ← 时间轴接口返回的预报数据 [接口A]`）

## 标注示例

### 新增代码（写代码时）

```ts
// BAD — 关键变量没有标注
function useChartData(source: string, region: string) {
  const [seriesData, setSeriesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const payload = {
    source,
    region,
    type: 'daily',
  };

  useEffect(() => {
    fetchData(payload).then(setSeriesData);
  }, [source, region]);
}
```

```ts
// GOOD — 关键变量逐行行尾标注
function useChartData(
  source: string, // ← 用户当前选择的图表数据来源模式（如"预报"/"实况"）
  region: string, // ← 地图上用户框选或点击的区域编码
) {
  const [seriesData, setSeriesData] = useState([]); // ← 图表渲染用的时序数据列表 [接口A]
  const [loading, setLoading] = useState(false);    // ← 控制图表区域的 loading 骨架屏显隐

  const payload = {
    source,        // ← 数据来源模式
    region,        // ← 区域编码
    type: 'daily', // ← 查询粒度：日维度
  };

  useEffect(() => {
    fetchData(payload).then(setSeriesData);
  }, [source, region]);
}
```

### 分析代码（解释代码时）

```ts
const forecastData = response.data; // ← 接口返回的原始预报数据 [接口A]

const timeline = forecastData.timeline; // ← 时间轴数据，每个节点代表一个预报时刻
const stations = forecastData.stations; // ← 站点列表，包含每个站点的经纬度和预报值

const activeIndex = timeline.findIndex(t => t.isCurrent); // ← 当前时刻在时间轴中的位置索引，用于高亮和默认定位
```

### TypeScript interface / 类型定义

```ts
type CommonReportChartProps = {
  title?: string;             // ← 组件外层标题，显示在卡片顶部
  chartTitle?: string;        // ← 图表内部标题，显示在 ECharts 内部
  xAxis?: string;             // ← 分类维度字段，比如时间、渠道、情感、业务域
  yAxis?: string;             // ← 指标字段，比如提及量、提及率、投诉量
  xAxisTitle?: string;        // ← X 轴标题文案
  yAxisTitle?: string;        // ← Y 轴标题文案
  topLimit?: number;          // ← Top 数据数量，现有规范是 1-50
  themeColor?: string;        // ← 主题色方案，比如 theme1
  legend?: boolean;           // ← 是否显示图例
  dataLabels?: boolean;       // ← 是否显示数据标签
  textColor?: string;         // ← 普通文字颜色
  textFontSize?: number;      // ← 普通文字字号
  axisTitleColor?: string;    // ← 坐标轴标题颜色
  axisTitleFontSize?: number; // ← 坐标轴标题字号
};
```

### 状态流转（复杂业务逻辑）

```ts
const [mode, setMode] = useState<'forecast' | 'live'>(defaultMode); // ← 页面当前的展示模式："预报"展示未来数据，"实况"展示已发生数据；切换会触发地图和图表重新请求

const submitPayload = useMemo(() => ({
  mode,               // ← 当前模式
  timeRange: range,   // ← 时间轴上用户框选的起止时间
  stations: selected, // ← 用户在地图上点选的站点 ID 列表
}), [mode, range, selected]); // ← 最终提交给分析接口的参数对象 [接口B]
```

## 与其他 Skill 的协作

这个 Skill 定义的是**标注动作**本身。当与其他 Skill 组合时：

- `understanding-code-logic`：分析代码时，贴出的所有代码片段必须带 `// ←` 标注
- `code-reviewer`：审查时，发现变量含义不明确必须要求补标注
- `change-impact-closure`：改动代码时，新增/修改的变量必须补标注
- `assert-normalize-boundary`：在边界层 normalize 后的字段，标注中要写清字段来源

## 检查清单

在提交任何包含代码的回复前，检查：

- [ ] 新增的关键变量、状态、字段是否全部有 `// ←` 标注
- [ ] 贴出的代码片段是否所有关键变量都已标注
- [ ] 标注内容是否是大白话业务含义，而非技术术语复读
- [ ] 是否每个变量单独标注，没有合并说明
- [ ] 接口相关字段是否标注了 `[接口X]` 引用
- [ ] 次要变量是否在存在歧义时补了标注

## Failure Modes

遇到以下情况要主动拦住：

- 写了 5 行以上新增代码但一个 `// ←` 都没有
- 分析代码时贴了裸代码片段（不带标注）
- 标注内容是"XX 变量""XX 状态"这种复读机写法
- 多个字段用一句 `// ← 以上三个是 XX 相关` 糊弄过去
- 标注里写的是调用关系（"这个函数在 XX 中被调用"），而不是数据含义
