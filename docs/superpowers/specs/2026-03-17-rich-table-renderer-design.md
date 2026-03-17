# Rich 版 ascii-table-renderer 设计文档

## 背景

当前 `skills/ascii-table-renderer/` 通过自定义 ASCII 渲染逻辑输出表格，长文本场景主要依赖截断和提示用户重新调用来查看完整内容。新的目标是在保持表格可读性的同时，尽量完整显示数据：

- 优先压缩列宽，而不是裁断内容。
- 当列宽不足时，在单元格内部换行，不使用 `...`、`…` 或其他省略标记。
- 表格本身尽量不超出目标宽度；只有在所有列已经压到最小宽度后才允许整表超宽。
- 使用 Python Rich 提供稳定的 Unicode 边框、终端宽度探测与显示宽度测量能力。

## 已确认的产品决策

- 直接替换现有 `skills/ascii-table-renderer/`，不新建平行 skill。
- 不要求兼容旧版 CLI 参数与旧版 JSON 输入格式，可以重新设计。
- 输出可以使用 Rich 的 Unicode 边框字符，不要求严格 ASCII 边框。
- 默认读取终端宽度，并允许 `--max-width` 显式覆盖。
- 总宽度超限时，优先继续压缩列宽并通过单元格内部换行保留完整数据。

## 目标

1. 让表格渲染结果在长文本场景下优先完整显示内容，而不是截断。
2. 让多列宽度竞争时仍然可以在目标宽度内尽量保持整表稳定。
3. 让调用方可以通过声明式列配置表达布局意图，而不是只能使用全局列宽限制。
4. 保持 CLI 工具属性：从 stdin 读取 JSON，输出到 stdout，错误输出到 stderr。
5. 让脚本、`SKILL.md`、示例和测试使用同一份对外输入合同，避免文档与实现分叉。

## 非目标

- 不支持合并单元格、多级表头、跨列/跨行布局。
- 不实现数据库/API 取数逻辑。
- 不保留旧版 `ellipsis` 风格行为。
- 不默认开启 Rich markup 解析。
- 第一版不支持数组行输入、CSV 输入或多数据源合并输入。

## 方案选择

本次采用 **Rich Table + 预换行** 方案。

原因：

- Rich 能提供稳定的 Unicode 边框、终端宽度探测和字符显示宽度测量。
- 仅依赖 Rich 自动布局对复杂长文本场景不够可控，需要在渲染前主动完成列宽预算与单元格预换行。
- 与完全自研布局引擎相比，该方案能在控制力与实现复杂度之间取得平衡。

## 目录与交付范围

本次改动聚焦现有 skill 目录：

- `skills/ascii-table-renderer/SKILL.md`
- `skills/ascii-table-renderer/scripts/render_table.py`
- `skills/ascii-table-renderer/examples/basic.md`
- `skills/ascii-table-renderer/` 下与渲染逻辑相关的测试文件

同步要求：

- `SKILL.md` 必须切换到新输入合同与新行为说明。
- `examples/basic.md` 必须使用新输入格式。
- 测试必须覆盖新合同，不再以旧版 `headers + rows + ellipsis` 作为默认基线。

## 对外输入合同

### 主调用路径

第一版只支持单一主路径：

- 从 stdin 读取一个 JSON 对象。
- JSON 顶层包含 `columns`、`rows`、`options` 三个字段。

示例：

```json
{
  "columns": [
    {
      "key": "name",
      "header": "Name",
      "align": "left",
      "min_width": 8,
      "priority": 1
    },
    {
      "key": "desc",
      "header": "Description",
      "align": "left",
      "min_width": 20,
      "priority": 3
    },
    {
      "key": "status",
      "header": "Status",
      "align": "center",
      "min_width": 8,
      "priority": 2
    }
  ],
  "rows": [
    {
      "name": "ascii-table-renderer",
      "desc": "Use Rich to wrap long cell content without truncating any data.",
      "status": "ready"
    }
  ],
  "options": {
    "max_width": 100,
    "box": "rounded",
    "show_header": true,
    "show_lines": false,
    "padding": [0, 1],
    "terminal_width_fallback": 100
  }
}
```

### `columns`

`columns` 为非空数组，每个元素必须是对象，且 `key` 唯一。

支持字段：

- `key`: 行对象取值键名，必填，不能为空字符串。
- `header`: 表头文本，默认回退到 `key`。
- `align`: `left | center | right`，默认 `left`。
- `min_width`: 列压缩下限，可选。
- `max_width`: 列上限，可选。
- `priority`: 列压缩优先级，默认 `100`；数字越小越重要，越晚被压缩。

校验规则：

- `columns` 为空时报错。
- 任意两个列对象 `key` 重复时报错。
- 若同时设置 `min_width` 与 `max_width`，且 `min_width > max_width`，报错。
- 若仅设置 `max_width`，则推导后的默认 `min_width` 必须再收敛为 `min(默认值, max_width)`，避免默认下限与列上限冲突。
- `align`、`priority`、宽度字段不合法时报错。

### `rows`

`rows` 必须是数组，数组元素必须是对象。

规则：

- 通过 `columns[*].key` 从每个行对象取值。
- 缺失字段或值为 `null` / `None` 时统一渲染为 `-`。
- 标量值（字符串、数字、布尔值）统一转为字符串后渲染。
- 数组与对象值统一使用紧凑 JSON 字符串渲染，保持数据完整且快照结果稳定。
- 行对象里多出的字段被忽略，不报错。
- 第一版不支持数组行，以避免顺序歧义与合同分叉。

### `options`

`options` 为可选对象，支持字段：

- `max_width`: 目标总宽度。
- `padding`: 单元格 padding，支持单个整数或 `[vertical, horizontal]` 两元素数组，默认 `[0, 1]`。
- `box`: Rich 边框风格名称，默认 `rounded`。
- `show_header`: 是否显示表头，默认 `true`。
- `show_lines`: 是否显示行间分隔线，默认 `false`。
- `terminal_width_fallback`: 终端宽度不可探测时的回退宽度，默认 `100`。

未知字段忽略，不报错。

## CLI 设计

CLI 只保留少量高价值覆盖项：

- `--max-width`
- `--box`
- `--no-header`
- `--json-path`

规则：

- 主路径仍然是 stdin JSON。
- `--json-path` 是调试/测试辅助入口，用于从文件读取 JSON；使用它时不再读取 stdin。
- CLI 参数优先级高于 JSON 中的 `options`。
- 若未显式传入 `--max-width`，则优先读取终端宽度。
- 若终端宽度不可用，则回退到 `options.terminal_width_fallback`。
- 若仍不可用，则使用内置默认值 `100`。

## Rich 集成契约

这是本实现最关键的执行约束，后续代码必须遵守：

1. 宽度测量、预换行、强制切分和验收校验必须使用同一套 Rich 显示宽度口径，禁止混用另一套自定义 East Asian 宽度算法。
2. 列宽由脚本先计算，再显式写回每个 Rich 列定义；不依赖 `Table.expand`、`ratio` 或 Rich 自动分宽来决定最终列宽。
3. 每列创建时必须显式设置：
   - `width=<最终列宽>`
   - `overflow="fold"`
   - `no_wrap=False`
   - `justify=<列对齐>`
4. 单元格内容统一以 Rich `Text` 对象传入；默认把内容视为普通文本，不解析 markup。
5. 输出时使用关闭 markup 解析的 Console，确保像 `[red]` 这类文本按字面显示，不触发样式解释。
6. 最终输出阶段必须显式设置 Console 宽度：正常场景使用目标总宽度；若所有列压到 `min_width` 后仍超宽，则使用“表格实际总宽度”作为 Console 宽度，避免 Rich 在表格层之外再次裁切或二次折行。
7. 表格边框、padding、是否显示 header、是否显示分隔线由 Rich 负责；列宽分配与换行策略由脚本负责。
8. 表头和单元格正文都遵循同一列宽约束；当列被压窄时，表头允许像正文一样在单元格内部换行。

## 渲染架构

渲染流程拆为三层：

1. **输入标准化**：解析 JSON、校验字段、补齐默认值。
2. **布局计算**：计算目标总宽度、列宽预算、压缩顺序和单元格预换行结果。
3. **Rich 输出**：将已经格式化好的多行内容交给 Rich `Table` 渲染最终边框与对齐。

Rich 负责最终绘制，不负责布局决策。

## 核心宽度算法

### 1. 计算目标总宽度

基准宽度优先级：

- `--max-width`
- 当前终端可用宽度
- `options.terminal_width_fallback`
- 内置默认值 `100`

从基准宽度中扣除以下开销，得到列内容可用净宽度：

- 左右边框宽度
- 列分隔符宽度
- `padding` 占用的左右空白

### 2. 计算每列候选宽度

每列维护三个宽度值：

- `min_width`
- `preferred_width`
- `max_width`

定义规则：

- `header_width`: 表头文本的 Rich 显示宽度。
- `content_width`: 该列所有单元格内容中“最长显式行”的 Rich 显示宽度最大值。若某个单元格原文含 `\n`，则按各段分别计宽，取段内最大值。
- `preferred_width = max(header_width, content_width)`；若定义了 `max_width`，则再向下截到 `max_width`。
- 若未显式提供 `min_width``，则基础默认值为 `min(max(header_width, 4), 12)`；若 `show_header=false`，则基础默认值改为 `4`。
- 若同时设置了 `max_width`，则默认 `min_width` 进一步收敛为 `min(基础默认值, max_width)`。
- 若显式或隐式得到的 `max_width < 1`，报错；若 `show_header=false` 且仅设置 `max_width`，则允许 `max_width < 4`，此时默认 `min_width` 直接收敛到该 `max_width`。

这套定义是确定性的：

- 不使用抽样、分位数或启发式估计。
- 同一输入必然得到同一初始列宽预算。

### 3. 初始分配

- 初始分配宽度定义为 `assigned_width = max(min_width, preferred_width)`；若定义了 `max_width`，则再校验 `assigned_width <= max_width`，否则按前述规则视为非法输入。
- 先按 `assigned_width` 给每列分配宽度。
- 若列宽总和不超过可用净宽度，则直接进入预换行阶段。
- 若超出，则进入压缩阶段。

### 4. 压缩阶段

压缩规则：

- 只缩列，不裁断文本。
- 按 `priority` 从大到小压缩；同优先级下优先压缩当前更宽的列；再相同时按原列顺序压缩。
- 任意列都不能小于其 `min_width`。
- 每次压缩 1 个显示宽度单位，直到满足目标净宽度，或所有列都达到 `min_width`。

压缩结果：

- 若列总宽度回到目标净宽度以内，继续正常渲染。
- 若全部列已压到 `min_width` 仍超宽，则停止压缩，允许整表最终超宽。

### 5. 单元格预换行

列宽确定后，对表头和每个单元格执行预换行：

- 保留原始 `\n` 作为段落边界。
- 每个段落内部按当前列宽继续折行。
- 优先在自然断点换行，自然断点包括：空白、`/`、`\\`、`-`、`_`、`.`。
- 在目标宽度内找不到自然断点时，按 Rich 显示宽度强制切分。
- 不允许插入 `...`、`…` 或其他省略标记。
- 不允许删除任何字符。

### 6. 行高处理

- 预换行阶段只负责生成多行文本，不手动补齐空白行。
- 同一数据行内多行单元格的最终高度对齐交给 Rich `Table` 负责。

## 边界行为

### 极长内容

- URL、路径、hash、base64 等长连续文本先尝试自然断点换行。
- 无自然断点时按显示宽度强制切分。
- 内容必须完整保留。

### 多列极限场景

- 当列很多、所有列均已压到 `min_width` 后仍超宽，允许整表超宽。
- 允许超宽是最后兜底；优先级低于“尽量压缩列宽”，但高于“裁断内容”。

### 空值、空表和无表头

- 空值、缺失值统一显示为 `-`。
- 若 `columns` 合法但 `rows` 为空且 `show_header=true`，输出只含表头的表格。
- 若 `columns` 合法但 `rows` 为空且 `show_header=false`，输出空字符串并返回 `0`。

### 样式与安全

- 默认禁用 Rich markup 解释，把输入当普通文本处理。
- 像 `[red]`、`[/]` 这类文本必须按字面显示。
- 后续若有需要，可通过显式开关单独开启 markup，但不属于第一版范围。

### 非法输入

以下情况输出明确错误到 `stderr` 并返回非零退出码：

- 非法 JSON。
- `columns` 缺少关键字段。
- `columns` 为空。
- 列 `key` 重复。
- `rows` 不是数组，或数组元素不是对象。
- 宽度字段、`priority`、`padding`、`align`、`box` 不合法。
- `min_width > max_width`。

不做静默降级或猜测修复。

## 测试方案

### 单元测试

至少覆盖以下模块：

- 输入标准化与参数优先级
- 列宽预算
- 压缩策略
- 单元格预换行
- 极限宽度下的兜底逻辑

### 快照测试

使用固定终端宽度和固定输入校验输出稳定性，重点覆盖：

- Unicode 边框
- 中英文混排
- 全角标点
- 多行单元格
- 表头本身需要换行
- `show_header=false`
- 不同 `box` / `padding` 组合

### 边界用例

至少包含：

- 超长 URL / 路径
- 显式换行符 `\n`
- 空值 / 缺失字段
- 空表
- 超多列
- 非法 JSON
- `--max-width` 覆盖终端宽度
- 非 TTY 环境下终端宽度探测失败
- 字面 markup 文本，如 `[red]value[/red]`
- emoji 与 combining characters

## 验收标准

1. 只要目标宽度仍可通过缩列满足，整表每行都不得超过目标宽度。
2. 若所有列都压到 `min_width` 仍无法满足目标宽度，则允许整表超宽，但不得裁断任何单元格内容。
3. 渲染器不得主动插入 `...`、`…` 或其他裁断标记。
4. 换行只能发生在单元格内部，不允许把整张表拆成多段输出。
5. 宽度计算、预换行和最终渲染必须遵守同一套 Rich 宽度口径。
6. 像 `[red]` 这样的文本必须按字面显示，不得被解释成样式。
7. 错误输入必须走明确失败路径：`stderr` 提示 + 非零退出码。
8. `SKILL.md`、示例和测试必须与脚本实现使用同一份输入合同。

## 实施提示

后续实现阶段优先保留单文件开发节奏，待核心逻辑稳定后再决定是否拆分内部模块，以避免过早抽象。