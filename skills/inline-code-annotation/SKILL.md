---
name: inline-code-annotation
description: "Use when a reply to the user contains code snippets — explaining, analyzing, reviewing code, or showing example code in chat. Annotate key variables, fields, and states inline with \"// ←\" so the reader understands the snippet at a glance without opening the source. Does NOT apply to code written into project files."
---

# Inline Code Annotation

## Overview

这个 skill 只管一件事：**回复里贴给用户看的代码片段，必须带 `// ←` 行尾标注**。

变量名能传达"叫什么"，但传达不了"这个值从哪来"、"业务上意味着什么"。用户看聊天里的代码片段时无法跳转定义，所以每个关键变量都要用最短的一句大白话把隐式知识钉在行尾。

## Scope

**适用（回复中展示的代码）：**

- 分析 / 解释代码时贴出的片段
- review 时引用的问题代码
- 给用户演示的示例代码、方案草稿、伪代码
- 对比 BAD / GOOD 写法时的两侧代码

**不适用（不要触发本 skill）：**

- 通过 Edit / Write 写入项目文件的代码——真实代码的注释密度遵循代码库既有风格和全局注释规范，不逐行标注
- 纯命令行输出、配置文件、日志
- 用户明确说"给我干净的代码，别加注释"

## Core Principle

**关键变量必须标注，自解释变量不标注。**

标注回答的不是"这个变量叫什么"（名称已经回答了），而是：

- 这个值从哪来（接口 A 的字段？用户选择？计算派生？）
- 这个值到哪去（发给后端？驱动 UI 显隐？传给子组件？）
- 这个值的业务含义（不是技术含义）

## 什么是"关键变量"（必须标注）

满足以下**任意一条**即为关键变量：

1. **状态变量**：`useState`、`ref`、store / context 中的值
2. **接口返回字段**：API 响应中进入渲染链路的字段
3. **Payload / 提交字段**：最终发给后端的参数对象中的字段
4. **派生 / 计算值**：`useMemo`、`computed`，尤其是跨多个上游来源的计算
5. **业务常量 / 枚举 / 配置**：值本身不直观，需要业务知识才能理解
6. **非自解释的函数参数**：如 `id` 自解释，但 `source: number` 需要说明来源
7. **条件分支的判断变量**：`if (flag)` 中含义不一眼可见的 `flag`
8. **回调 / handler**：被谁触发、触发后产生什么效果

## 什么不用标注

1. 循环索引 `i`, `j`, `index`（除非有业务歧义）
2. 名称与来源一致的简单解构（如 `const { name, age } = user`，`user` 已标注）
3. 框架标准惯例变量（`setState`、`navigate` 这类）
4. 一眼能看出含义、作用域不超过 5 行的局部变量
5. **同一片段中已标注过的变量再次出现**（如已标注的 `source` 又被塞进 payload），不重复标注

## 标注格式

```ts
const variableName = someValue; // ← 大白话业务含义
```

- 标注**一律放在行尾**，紧跟被标注变量所在行；不得另起一行、不得放上方或下方
- 一句话说清，不超过 30 个字
- 用大白话，不用术语复读（说"用户选中的时间范围"而不是"timeRange 状态"）
- 变量来自接口时，标注 `[接口名]` 引用（如 `// ← 时间轴接口返回的预报数据 [接口A]`）
- interface / type 字段、多行函数参数：每行行尾各自标注

## 标注示例

### 解释 / 分析代码

```ts
const forecastData = response.data; // ← 接口返回的原始预报数据 [接口A]

const timeline = forecastData.timeline; // ← 时间轴数据，每个节点代表一个预报时刻
const stations = forecastData.stations; // ← 站点列表，含每个站点的经纬度和预报值

const activeIndex = timeline.findIndex(t => t.isCurrent); // ← 当前时刻在时间轴中的位置，用于高亮和默认定位
```

### 示例代码 / 方案草稿

```ts
function useChartData(
  source: string, // ← 用户当前选择的数据来源模式（如"预报"/"实况"）
  region: string, // ← 地图上用户框选或点击的区域编码
) {
  const [seriesData, setSeriesData] = useState([]); // ← 图表渲染用的时序数据列表 [接口A]
  const [loading, setLoading] = useState(false);    // ← 控制图表区域的 loading 骨架屏显隐

  const payload = {
    source,
    region,
    type: 'daily', // ← 查询粒度：日维度
  };

  useEffect(() => {
    fetchData(payload).then(setSeriesData);
  }, [source, region]);
}
```

`source` / `region` 在参数处已标注，payload 中原样透传不重复标注；只有新出现的 `type: 'daily'` 需要标注。

### TypeScript interface / 类型定义

```ts
type ReportChartProps = {
  title?: string;    // ← 组件外层标题，显示在卡片顶部
  xAxis?: string;    // ← 分类维度字段，比如时间、渠道、业务域
  yAxis?: string;    // ← 指标字段，比如提及量、投诉量
  topLimit?: number; // ← Top 数据数量，现有规范是 1-50
  legend?: boolean;  // ← 是否显示图例
};
```

### 状态流转（复杂业务逻辑）

```ts
const [mode, setMode] = useState<'forecast' | 'live'>(defaultMode); // ← 页面展示模式："预报"看未来数据，"实况"看已发生数据；切换会触发重新请求

const submitPayload = useMemo(() => ({
  mode,               // ← 当前模式
  timeRange: range,   // ← 时间轴上用户框选的起止时间
  stations: selected, // ← 用户在地图上点选的站点 ID 列表
}), [mode, range, selected]); // ← 最终提交给分析接口的参数对象 [接口B]
```

## Red Lines

- 回复中贴出的代码片段，关键变量**必须**标注后再呈现，不得贴裸代码
- 标注内容必须是**大白话业务含义**，不得用技术术语重复变量名
- 严禁把多个字段合并成一句模糊说明，严禁用"同上""类似"跳过
- 不得在标注中写调用关系（"这个函数在 XX 中被调用"）——标注回答的是**数据含义**
- 本 skill 的标注要求**不外溢到写入文件的代码**；落盘代码的注释按代码库风格来

## 与其他 Skill 的协作

- `understanding-code-logic`：分析代码时贴出的所有片段必须带 `// ←` 标注（该 skill 的"变量与代码解释铁律"由本 skill 承接）
- `api-field-contract-guard`：标注接口字段时，`[接口X]` 引用只能指向已确认的契约来源，未确认字段沿用其"[推测]"标记

## 检查清单

发送包含代码片段的回复前，检查：

- [ ] 片段中的关键变量、状态、字段是否全部有 `// ←` 标注
- [ ] 标注是否是大白话业务含义，而非术语复读
- [ ] 是否没有重复标注同一片段中已标注过的变量
- [ ] 接口相关字段是否标注了 `[接口X]` 引用
- [ ] 是否没有把标注要求带进写入项目文件的代码

## Failure Modes

遇到以下情况要主动拦住：

- 分析代码时贴了裸代码片段（不带标注）
- 标注内容是"XX 变量""XX 状态"这种复读机写法
- 多个字段用一句 `// ← 以上三个是 XX 相关` 糊弄过去
- 把逐行标注习惯带进了 Edit / Write 落盘的代码，制造注释噪音
