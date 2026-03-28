---
name: ascii-table-renderer
description: Render any kind of structured data, lists, comparisons, or multi-field records as aligned terminal tables with Rich Unicode borders and safe wrapping. Extensively used for AI chat responses, log visualizations, and terminal output. ALWAYS use this skill whenever displaying multiple properties of items, comparing things, listing status, fetching records, or when data is better presented in rows and columns to ensure a beautiful, readable, and perfectly aligned output.
license: Complete terms in LICENSE.txt
dependencies:
  - python>=3.8
  - rich
---

## When to use this skill

**CRITICAL TRIGGER RULE**

- Use this skill whenever you need to present structured data (lists, records, statistics, etc.) to the user.
- Use this skill to beautify any table output in your response.
- Use this skill when the user explicitly asks for a table or when a table is the best way to present the information.

**🚨 IMPORTANT: HOW TO EXECUTE 🚨**
- **DO NOT attempt to draw the ASCII table yourself in the chat response.** LLMs cannot correctly calculate East Asian character widths (like Chinese or IDEographic punctuation), meaning your manually generated borders will ALWAYS be misaligned!
- You **MUST** use the terminal tool (`run_command`) to execute `scripts/render_table.py` by passing pure JSON via `cat << 'EOF'`.
- **CRITICAL**: DO NOT use a Python heredoc (`python - <<'PY'`) with a Python dictionary literal to generate the JSON, as this frequently causes `NameError: name 'true' is not defined` when handling boolean values (`true` vs `True`). ALWAYS pipe pure JSON string using `cat << 'EOF'`.

Example of the ONLY correct way to execute:
```bash
cat << 'EOF' | python3 /absolute/path/to/skills/ascii-table-renderer/scripts/render_table.py
{
  "columns": [{"key": "id", "header": "ID"}],
  "rows": [{"id": "1"}],
  "options": { "show_lines": true }
}
EOF
```

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
- Default output uses Rich Unicode borders, not ASCII-only `+ - |`.
- Long content should wrap inside cells instead of being truncated with `...`.
- Out of scope: merged cells, multi-row headers, complex spanning layouts, array-row input.

## How to use this skill

### Inputs

The script reads a JSON object from stdin with this shape:

- `columns` (required): non-empty array of column objects
  - `key` (required)
  - `header` (optional, defaults to `key`)
  - `align` (`left` | `center` | `right`)
  - `min_width` (optional)
  - `max_width` (optional)
  - `priority` (optional, default `100`)
- `rows` (required): array of row objects; array rows are not supported
- `options` (optional):
  - `max_width`
  - `padding`
  - `box`
  - `show_header`
  - `show_lines`
  - `terminal_width_fallback`

### CLI overrides

- `--max-width`
- `--box`
- `--no-header`
- `--json-path`

CLI overrides take precedence over JSON `options`.

### Behavior guarantees

- Null / missing values render as `-`
- Scalars render as strings
- Objects / arrays render as compact JSON text
- Markup-like text such as `[red]value[/red]` is rendered literally
- Cell content wraps without inserting `...` or `…`
- The renderer tries to keep the whole table within the target width, but if every column is already at its minimum width it may allow the table to grow wider rather than lose content

## Script

- `scripts/render_table.py`: render a Rich table from JSON stdin or `--json-path`

## Examples

- `examples/basic.md`

## Quality checklist

1. Columns align consistently; the renderer stays within the target width whenever possible and only exceeds it when preserving content requires a wider render
2. Null values are rendered as `-`
3. Copy/paste safe (no trailing spaces)

## Keywords

**English:** ascii-table-renderer, ascii table, align, columns, rows, truncate, wrap, terminal, log, AI response, chat output
**中文:** ascii-table-renderer, ASCII 表格渲染, 对齐, 列宽, 截断, 换行, 终端, 日志, 工单, AI 回复, 聊天输出
