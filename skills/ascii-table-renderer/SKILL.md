---
name: ascii-table-renderer
description: Render any kind of structured data, lists, comparisons, or multi-field records as aligned ASCII tables. Extensively used for AI chat responses, log visualizations, and terminal output. ALWAYS use this skill whenever displaying multiple properties of items, comparing things, listing status, fetching records, or when data is better presented in rows and columns to ensure a beautiful, readable, and perfectly aligned output.
license: Complete terms in LICENSE.txt
dependencies:
  - python>=3.8
---

## When to use this skill

**CRITICAL TRIGGER RULE**

- Use this skill whenever you need to present structured data (lists, records, statistics, etc.) to the user.
- Use this skill to beautify any table output in your response.
- Use this skill when the user explicitly asks for a table or when a table is the best way to present the information.

**Trigger phrases include:**

- "ascii-table-renderer" / "表格" (table)
- "生成表格" / "显示为表格" (generate/show as table)
- "列出..." / "列表" (list... / list)
- "对比..." / "比较..." (compare...)
- "Show me a table of..." / "Format as table"
- "Summarize in a table" / "Present as a grid"
- "List all..." / "List the details of..."
- "Compare options" / "Show status of..."
- Any request to retrieve structured records (e.g., getting users, fetching files, displaying configurations, analyzing metrics).
- Any implicit need for a structured layout (e.g., "show user details", "what are the differences", "give me an overview of").

## Boundary

- Do not fetch data (DB/API). Only render and format output.
- Default borders are ASCII-only: `+ - |`.
- Out of scope: merged cells, multi-row headers, complex spanning layouts.

## How to use this skill

### Inputs

- headers (required)
- rows (required)
- maxWidth (default 80)
- maxColWidth (default 20)
- borderStyle (light | minimal, default light)
- overflow (ellipsis | wrap, default ellipsis)
- align (left | right | center, default left)

### Outputs (required)

- tableCompact (log-friendly)
- tableReadable (interactive-friendly)
- rules (width/truncation/null/alignment rules)
- **Note**: If the generated table exceeds the `maxWidth` or cell contents are truncated due to `maxColWidth`, the script will automatically append a recall instruction with suggested parameters to generate the full table.

### Steps

1. Compute per-column widths: `min(maxColWidth, max(contentWidth))`
2. Handle overflow:
   - ellipsis: use `...` consistently
   - wrap: wrap within column width while keeping row alignment
3. Output two variants:
   - compact: minimal or fewer separators
   - readable: clearer borders

## Script

- `scripts/render_table.py`: render tables from JSON stdin (compact/readable)

## Examples

- `examples/basic.md`

## Quality checklist

1. Columns align consistently; each line does not exceed maxWidth
2. Null values are rendered as `-`
3. Copy/paste safe (no trailing spaces)

## Keywords

**English:** ascii-table-renderer, ascii table, align, columns, rows, truncate, wrap, terminal, log, AI response, chat output
**中文:** ascii-table-renderer, ASCII 表格渲染, 对齐, 列宽, 截断, 换行, 终端, 日志, 工单, AI 回复, 聊天输出
