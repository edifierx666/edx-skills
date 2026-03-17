# Rich Table Renderer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `skills/ascii-table-renderer` with a Python Rich-based renderer that keeps cell data intact, wraps inside cells when needed, and keeps the full table within target width whenever possible.

**Architecture:** Keep the skill in place but rewrite the renderer around a deterministic pipeline: normalize JSON input, compute column widths and wrapping with one width model, then hand fixed-width columns and preprocessed `Text` content to Rich for final rendering. Update the skill contract, example, and tests together so docs and behavior stay aligned.

**Tech Stack:** Python 3.8+, Rich, pytest

---

## Chunk 1: Failing Tests And Dependency Contract

### Task 1: Add regression tests for the new JSON contract and wrapping rules

**Files:**
- Create: `skills/ascii-table-renderer/test_render_table_rich.py`
- Modify: `skills/ascii-table-renderer/SKILL.md`

- [ ] **Step 1: Write the failing test for the new object-based input contract**

```python
import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "scripts" / "render_table.py"


def run_renderer(payload, *args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=False,
    )


def test_renders_new_columns_rows_options_contract():
    payload = {
        "columns": [
            {"key": "name", "header": "Name"},
            {"key": "desc", "header": "Description", "min_width": 8, "priority": 200},
        ],
        "rows": [{"name": "alpha", "desc": "long text that should wrap instead of truncate"}],
        "options": {"max_width": 36, "box": "rounded"},
    }

    result = run_renderer(payload)

    assert result.returncode == 0
    assert "Name" in result.stdout
    assert "Description" in result.stdout
```

- [ ] **Step 2: Run the single test and verify it fails for the expected reason**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_renders_new_columns_rows_options_contract -v`
Expected: FAIL because current script still expects `headers` / `rows` and/or does not render the Rich-based output contract.

- [ ] **Step 3: Add a failing test proving long content wraps without ellipsis**

```python
def test_wraps_long_cell_content_without_ellipsis():
    payload = {
        "columns": [
            {"key": "title", "header": "Title", "min_width": 8},
            {"key": "details", "header": "Details", "min_width": 10, "priority": 200},
        ],
        "rows": [
            {
                "title": "sample",
                "details": "this is a very long sentence that must wrap inside the cell",
            }
        ],
        "options": {"max_width": 34},
    }

    result = run_renderer(payload)

    assert result.returncode == 0
    assert "..." not in result.stdout
    assert "must wrap" in result.stdout
```

- [ ] **Step 4: Run the wrapping test and verify it fails correctly**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_wraps_long_cell_content_without_ellipsis -v`
Expected: FAIL because current renderer truncates or uses the legacy contract.

- [ ] **Step 5: Add a failing test for literal markup and structured values**

```python
def test_preserves_literal_markup_and_json_stringifies_structured_values():
    payload = {
        "columns": [
            {"key": "label", "header": "Label"},
            {"key": "meta", "header": "Meta", "min_width": 8},
        ],
        "rows": [
            {
                "label": "[red]value[/red]",
                "meta": {"enabled": True, "count": 2},
            }
        ],
        "options": {"max_width": 48},
    }

    result = run_renderer(payload)

    assert result.returncode == 0
    assert "[red]value[/red]" in result.stdout
    assert '{"enabled":true,"count":2}' in result.stdout
```

- [ ] **Step 6: Run the full new test file and verify all new tests fail**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py -v`
Expected: FAIL with failures tied to missing Rich behavior, not syntax/import mistakes in the test file.

- [ ] **Step 7: Update the skill dependency contract to include Rich before implementation relies on it**

```yaml
dependencies:
  - python>=3.8
  - rich
```

- [ ] **Step 8: Commit the red-state setup**

```bash
git add skills/ascii-table-renderer/test_render_table_rich.py skills/ascii-table-renderer/SKILL.md
git commit -m "test: add rich renderer regression coverage"
```

## Chunk 2: Rich Renderer Implementation

### Task 2: Replace the legacy renderer with a Rich-based implementation

**Files:**
- Modify: `skills/ascii-table-renderer/scripts/render_table.py`
- Test: `skills/ascii-table-renderer/test_render_table_rich.py`

- [ ] **Step 1: Implement minimal input parsing for `columns`, `rows`, and `options`**

```python
@dataclass(frozen=True)
class ColumnSpec:
    key: str
    header: str
    align: str
    min_width: int | None
    max_width: int | None
    priority: int
```

Add normalization helpers that validate:
- non-empty `columns`
- unique `key`
- object rows only
- `min_width <= max_width`
- CLI options override JSON `options`

- [ ] **Step 2: Run the first contract test and make only that test pass**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_renders_new_columns_rows_options_contract -v`
Expected: PASS

- [ ] **Step 3: Implement deterministic width calculation and wrapping helpers**

```python
def compute_column_widths(...):
    ...


def wrap_cell_text(...):
    ...
```

Requirements:
- one width model throughout
- `assigned_width = max(min_width, preferred_width)`
- shrink columns by `priority` and current width
- wrap at natural breakpoints first, hard-break when necessary
- never insert ellipsis

- [ ] **Step 4: Run the wrapping-focused test and make it pass**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_wraps_long_cell_content_without_ellipsis -v`
Expected: PASS

- [ ] **Step 5: Implement Rich rendering with fixed-width columns and literal text output**

```python
console = Console(..., markup=False, width=render_width)
table = Table(...)
table.add_column(..., width=column.width, overflow="fold", no_wrap=False)
```

Requirements:
- use Rich `Text` for cell content
- use Unicode box style
- disable markup interpretation
- set console width to target width or actual table width in overflow fallback mode

- [ ] **Step 6: Run the literal-markup/JSON-stringify test and make it pass**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_preserves_literal_markup_and_json_stringifies_structured_values -v`
Expected: PASS

- [ ] **Step 7: Add one more regression test for invalid input and implement the matching error path**

```python
def test_rejects_duplicate_column_keys():
    payload = {
        "columns": [
            {"key": "name", "header": "Name"},
            {"key": "name", "header": "Again"},
        ],
        "rows": [],
        "options": {},
    }

    result = run_renderer(payload)

    assert result.returncode != 0
    assert "duplicate" in result.stderr.lower()
```

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_rejects_duplicate_column_keys -v`
Expected: PASS

- [ ] **Step 8: Run the full renderer test file and confirm all tests pass**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py -v`
Expected: PASS

- [ ] **Step 9: Commit the renderer implementation**

```bash
git add skills/ascii-table-renderer/scripts/render_table.py skills/ascii-table-renderer/test_render_table_rich.py
git commit -m "feat: replace ascii renderer with rich wrapping output"
```

## Chunk 3: Documentation, Example, And Final Verification

### Task 3: Align skill docs and examples with the shipped behavior

**Files:**
- Modify: `skills/ascii-table-renderer/SKILL.md`
- Modify: `skills/ascii-table-renderer/examples/basic.md`
- Test: `skills/ascii-table-renderer/test_render_table_rich.py`

- [ ] **Step 1: Rewrite the skill input/output docs to match the shipped contract**

Update `SKILL.md` so it documents:
- `columns + rows + options`
- Rich dependency
- Unicode borders instead of ASCII-only wording
- wrapping-without-ellipsis behavior
- `--max-width`, `--box`, `--no-header`, `--json-path`

- [ ] **Step 2: Replace the example file with the new JSON contract and representative output**

Use an example that shows:
- object rows
- long text wrapping inside a cell
- Unicode border output

- [ ] **Step 3: Add a documentation-facing regression test for no-header empty-table behavior**

```python
def test_returns_empty_output_for_empty_rows_without_header():
    payload = {
        "columns": [{"key": "name", "header": "Name"}],
        "rows": [],
        "options": {"show_header": False},
    }

    result = run_renderer(payload)

    assert result.returncode == 0
    assert result.stdout == "\n" or result.stdout == ""
```

- [ ] **Step 4: Run the new no-header regression and make it pass**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py::test_returns_empty_output_for_empty_rows_without_header -v`
Expected: PASS

- [ ] **Step 5: Run the entire focused test file again**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py -v`
Expected: PASS

- [ ] **Step 6: Smoke-test the CLI with the example payload**

Run: `python3 skills/ascii-table-renderer/scripts/render_table.py --json-path skills/ascii-table-renderer/example-input.json`
Expected: exit code `0` and Rich table output with wrapped long text and no ellipsis.

- [ ] **Step 7: Commit the documentation and example sync**

```bash
git add skills/ascii-table-renderer/SKILL.md skills/ascii-table-renderer/examples/basic.md skills/ascii-table-renderer/test_render_table_rich.py
git commit -m "docs: align ascii-table-renderer skill with rich output"
```

## Chunk 4: Final Verification And Handoff

### Task 4: Verify the finished implementation end-to-end

**Files:**
- Modify: none expected
- Test: `skills/ascii-table-renderer/test_render_table_rich.py`

- [ ] **Step 1: Run the focused regression suite one final time**

Run: `python3 -m pytest skills/ascii-table-renderer/test_render_table_rich.py -v`
Expected: PASS

- [ ] **Step 2: Run a manual CLI sample with narrow width to confirm wrapping behavior**

Run:

```bash
python3 skills/ascii-table-renderer/scripts/render_table.py --max-width 36 <<'JSON'
{
  "columns": [
    {"key": "name", "header": "Name"},
    {"key": "desc", "header": "Description", "min_width": 8, "priority": 200}
  ],
  "rows": [
    {"name": "alpha", "desc": "this is a long sentence that should wrap inside the table cell"}
  ],
  "options": {"box": "rounded"}
}
JSON
```

Expected:
- exit code `0`
- wrapped cell text
- no `...`
- Unicode borders

- [ ] **Step 3: Run a manual CLI sample with literal markup text**

Run:

```bash
python3 skills/ascii-table-renderer/scripts/render_table.py <<'JSON'
{
  "columns": [
    {"key": "label", "header": "Label"},
    {"key": "meta", "header": "Meta"}
  ],
  "rows": [
    {"label": "[red]value[/red]", "meta": {"enabled": true, "count": 2}}
  ],
  "options": {"max_width": 60}
}
JSON
```

Expected:
- output contains literal `[red]value[/red]`
- no style interpretation
- structured object rendered as compact JSON text

- [ ] **Step 4: Run git diff for a final review**

Run: `git -C /Volumes/ZY/www3/github-star-pro/edx-skills diff -- skills/ascii-table-renderer docs/superpowers`
Expected: only the planned renderer, test, doc, and example changes appear.

- [ ] **Step 5: Commit or hand off for final branch-finishing workflow**

```bash
git status --short
```

Expected: clean tree or only intentional changes.
