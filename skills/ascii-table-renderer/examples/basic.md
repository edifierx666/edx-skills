# ascii-table-renderer：基础示例

## Input

```json
{
  "columns": [
    {"key": "name", "header": "Name"},
    {"key": "desc", "header": "Description", "min_width": 8, "priority": 200},
    {"key": "status", "header": "Status", "align": "center", "min_width": 6}
  ],
  "rows": [
    {
      "name": "ascii-table-renderer",
      "desc": "Use Rich to wrap long cell content without truncating any data, even when the terminal is narrow.",
      "status": "ready"
    }
  ],
  "options": {
    "max_width": 56,
    "box": "rounded",
    "show_header": true,
    "show_lines": false,
    "padding": [0, 1]
  }
}
```

## Output

```text
╭──────────────────────┬──────────────────────┬────────╮
│ Name                 │ Description          │ Status │
├──────────────────────┼──────────────────────┼────────┤
│ ascii-table-renderer │ Use Rich to wrap     │ ready  │
│                      │ long cell content    │        │
│                      │ without truncating   │        │
│                      │ any data, even when  │        │
│                      │ the terminal is      │        │
│                      │ narrow.              │        │
╰──────────────────────┴──────────────────────┴────────╯
```

## Script usage

```bash
cat <<'JSON' | python3 scripts/render_table.py --max-width 56
{
  "columns": [
    {"key": "name", "header": "Name"},
    {"key": "desc", "header": "Description", "min_width": 8, "priority": 200},
    {"key": "status", "header": "Status", "align": "center", "min_width": 6}
  ],
  "rows": [
    {
      "name": "ascii-table-renderer",
      "desc": "Use Rich to wrap long cell content without truncating any data, even when the terminal is narrow.",
      "status": "ready"
    }
  ],
  "options": {
    "box": "rounded",
    "show_header": true,
    "show_lines": false,
    "padding": [0, 1]
  }
}
JSON
```
