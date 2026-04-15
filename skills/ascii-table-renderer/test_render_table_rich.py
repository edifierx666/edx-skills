import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parent / "scripts" / "render_table.py"
_LAYOUT_NOISE = re.compile(r"[\s\u2500-\u257f]+")
REAL_RICH_AVAILABLE = importlib.util.find_spec("rich") is not None


def _renderer_command(*args):
    return [sys.executable, str(SCRIPT), *args]


def run_renderer(payload, *args):
    with tempfile.TemporaryDirectory() as tmpdir:
        _install_rich_stub(Path(tmpdir))
        env = os.environ.copy()
        pythonpath = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            f"{tmpdir}{os.pathsep}{pythonpath}" if pythonpath else tmpdir
        )
        return subprocess.run(
            _renderer_command(*args),
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )


def run_renderer_real_rich(payload, *args):
    return subprocess.run(
        _renderer_command(*args),
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=False,
        env=os.environ.copy(),
    )


def run_renderer_from_json_path(payload, *args):
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        _install_rich_stub(root)
        payload_path = root / "payload.json"
        payload_path.write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
        env = os.environ.copy()
        pythonpath = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            f"{tmpdir}{os.pathsep}{pythonpath}" if pythonpath else tmpdir
        )
        return subprocess.run(
            _renderer_command("--json-path", str(payload_path), *args),
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )


def _install_rich_stub(root):
    rich_dir = root / "rich"
    rich_dir.mkdir()
    for name, content in _rich_stub_files().items():
        (rich_dir / name).write_text(textwrap.dedent(content), encoding="utf-8")


def _rich_stub_files():
    return {
        "__init__.py": (
            "from . import box, cells\n"
            "from .console import Console\n"
            "from .table import Table\n"
            "from .text import Text\n"
        ),
        "box.py": (
            "class Box:\n"
            "    def __init__(self, name):\n"
            "        self.name = name\n"
            "\n"
            "\n"
            'ROUNDED = Box("rounded")\n'
        ),
        "cells.py": (
            "def cell_len(text):\n"
            "    return len(str(text))\n"
            "\n"
            "\n"
            "def chop_cells(text, width):\n"
            "    text = str(text)\n"
            "    if width < 1:\n"
            "        return [text]\n"
            '    return [text[index:index + width] for index in range(0, len(text), width)] or [""]\n'
        ),
        "text.py": (
            "class Text(str):\n"
            '    def __new__(cls, value=""):\n'
            "        return super().__new__(cls, str(value))\n"
        ),
        "console.py": (
            "import sys\n"
            "\n"
            "\n"
            "class MeasureResult:\n"
            "    def __init__(self, maximum):\n"
            "        self.maximum = maximum\n"
            "\n"
            "\n"
            "class Console:\n"
            "    def __init__(self, file=None, width=80, **kwargs):\n"
            "        self.file = file or sys.stdout\n"
            "        self.width = width\n"
            "\n"
            "    def measure(self, table):\n"
            "        return MeasureResult(table.measure())\n"
            "\n"
            "    def print(self, table):\n"
            "        self.file.write(table.render())\n"
            '        self.file.write("\\n")\n'
        ),
        "table.py": (
            "class Table:\n"
            "    def __init__(self, box=None, show_header=True, show_lines=False, padding=(0, 1), expand=False):\n"
            "        self.box = box\n"
            "        self.show_header = show_header\n"
            "        self.show_lines = show_lines\n"
            "        self.padding = padding\n"
            "        self.columns = []\n"
            "        self.rows = []\n"
            "\n"
            '    def add_column(self, header="", justify="left", width=None, overflow="fold", no_wrap=False):\n'
            "        self.columns.append(\n"
            "            {\n"
            '                "header": str(header),\n'
            '                "justify": justify,\n'
            '                "width": int(width or 0),\n'
            "            }\n"
            "        )\n"
            "\n"
            "    def add_row(self, *values):\n"
            "        self.rows.append([str(value) for value in values])\n"
            "\n"
            "    def measure(self):\n"
            "        lines = self.render().splitlines()\n"
            "        return max((len(line) for line in lines), default=0)\n"
            "\n"
            "    def render(self):\n"
            "        if not self.columns:\n"
            '            return ""\n'
            "\n"
            "        lines = []\n"
            '        lines.append(self._rule("╭", "┬", "╮", "─"))\n'
            "        if self.show_header:\n"
            '            lines.extend(self._render_row([column["header"] for column in self.columns]))\n'
            '            lines.append(self._rule("├", "┼", "┤", "─"))\n'
            "        for index, row in enumerate(self.rows):\n"
            "            lines.extend(self._render_row(row))\n"
            "            if self.show_lines and index != len(self.rows) - 1:\n"
            '                lines.append(self._rule("├", "┼", "┤", "─"))\n'
            '        lines.append(self._rule("╰", "┴", "╯", "─"))\n'
            '        return "\\n".join(lines)\n'
            "\n"
            "    def _rule(self, left, middle, right, fill):\n"
            "        horizontal = self.padding[1] * 2\n"
            '        parts = [fill * (column["width"] + horizontal) for column in self.columns]\n'
            "        return left + middle.join(parts) + right\n"
            "\n"
            "    def _render_row(self, values):\n"
            '        height = max(len(str(value).split("\\n")) for value in values) if values else 1\n'
            "        rendered = []\n"
            "        for line_index in range(height):\n"
            "            cells = []\n"
            "            for column, raw_value in zip(self.columns, values):\n"
            '                segments = str(raw_value).split("\\n")\n'
            '                segment = segments[line_index] if line_index < len(segments) else ""\n'
            "                cells.append(\n"
            '                    " " * self.padding[1]\n'
            '                    + self._justify(segment, column["width"], column["justify"])\n'
            '                    + " " * self.padding[1]\n'
            "                )\n"
            '            rendered.append("│" + "│".join(cells) + "│")\n'
            "        return rendered\n"
            "\n"
            "    def _justify(self, text, width, mode):\n"
            "        text = str(text)\n"
            "        extra = max(0, width - len(text))\n"
            '        if mode == "right":\n'
            '            return " " * extra + text\n'
            '        if mode == "center":\n'
            "            left = extra // 2\n"
            '            return " " * left + text + " " * (extra - left)\n'
            '        return text + " " * extra\n'
        ),
    }


def collapse_wrapped_table_text(text):
    return _LAYOUT_NOISE.sub("", text)


class RichRendererRegressionTests(unittest.TestCase):
    @unittest.skipUnless(REAL_RICH_AVAILABLE, "real rich is not available")
    def test_real_rich_broken_pipe_does_not_leak_traceback(self):
        payload = {
            "columns": [{"key": "name", "header": "Name"}],
            "rows": [{"name": "alpha"}] * 256,
            "options": {"max_width": 20},
        }

        proc = subprocess.Popen(
            _renderer_command(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=os.environ.copy(),
        )
        try:
            assert proc.stdin is not None
            assert proc.stdout is not None
            assert proc.stderr is not None

            proc.stdout.close()
            proc.stdin.write(json.dumps(payload, ensure_ascii=False))
            proc.stdin.close()
            stderr = proc.stderr.read()
            returncode = proc.wait()
            proc.stderr.close()
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()

        self.assertNotEqual(returncode, 0)
        self.assertNotIn("traceback", stderr.lower())
        self.assertNotIn("brokenpipeerror", stderr.lower())
        self.assertNotIn("exception ignored", stderr.lower())

    @unittest.skipUnless(REAL_RICH_AVAILABLE, "real rich is not available")
    def test_real_rich_keeps_double_width_character_in_narrow_column(self):
        payload = {
            "columns": [
                {
                    "key": "wide",
                    "header": "Wide",
                    "min_width": 1,
                    "max_width": 1,
                    "priority": 200,
                },
                {
                    "key": "other",
                    "header": "Other",
                    "min_width": 1,
                    "max_width": 1,
                    "priority": 100,
                },
            ],
            "rows": [{"wide": "好", "other": "x"}],
            "options": {"max_width": 10, "box": "rounded"},
        }

        result = run_renderer_real_rich(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("好", result.stdout)

    @unittest.skipUnless(REAL_RICH_AVAILABLE, "real rich is not available")
    def test_real_rich_uses_ascii_box_for_cjk_content_by_default(self):
        payload = {
            "columns": [
                {"key": "pkg", "header": "包名"},
                {"key": "usage", "header": "用途", "max_width": 18},
            ],
            "rows": [
                {"pkg": "ol", "usage": "OpenLayers 地图库"},
                {"pkg": "ol-ext", "usage": "OpenLayers 扩展插件"},
            ],
            "options": {"max_width": 40, "box": "rounded", "show_lines": True},
        }

        result = run_renderer_real_rich(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("+", result.stdout)
        self.assertIn("|", result.stdout)
        self.assertNotIn("╭", result.stdout)
        self.assertNotIn("│", result.stdout)

    @unittest.skipUnless(REAL_RICH_AVAILABLE, "real rich is not available")
    def test_real_rich_can_keep_unicode_box_when_cjk_safe_disabled(self):
        payload = {
            "columns": [
                {"key": "pkg", "header": "包名"},
                {"key": "usage", "header": "用途", "max_width": 18},
            ],
            "rows": [
                {"pkg": "ol", "usage": "OpenLayers 地图库"},
            ],
            "options": {
                "max_width": 40,
                "box": "rounded",
                "show_lines": True,
                "cjk_safe": False,
            },
        }

        result = run_renderer_real_rich(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("╭", result.stdout)
        self.assertIn("│", result.stdout)

    def test_renders_new_columns_rows_options_contract(self):
        payload = {
            "columns": [
                {"key": "name", "header": "Name"},
                {
                    "key": "desc",
                    "header": "Description",
                    "min_width": 8,
                    "priority": 200,
                },
            ],
            "rows": [
                {
                    "name": "alpha",
                    "desc": "long text that should wrap instead of truncate",
                }
            ],
            "options": {"max_width": 36, "box": "rounded"},
        }

        result = run_renderer(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("Name", result.stdout)
        self.assertIn("Description", result.stdout)
        self.assertIn("alpha", result.stdout)

    def test_wraps_long_cell_content_without_ellipsis(self):
        details = "this is a very long sentence that must wrap inside the cell"
        payload = {
            "columns": [
                {"key": "title", "header": "Title", "min_width": 8},
                {
                    "key": "details",
                    "header": "Details",
                    "min_width": 10,
                    "priority": 200,
                },
            ],
            "rows": [{"title": "sample", "details": details}],
            "options": {"max_width": 34},
        }

        result = run_renderer(payload)
        non_empty_lines = [line for line in result.stdout.splitlines() if line.strip()]
        detail_lines = [
            line
            for line in non_empty_lines
            if any(word in line.lower() for word in ("this", "sentence", "inside"))
        ]

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertNotIn("...", result.stdout)
        self.assertNotIn("…", result.stdout)
        self.assertIn(
            collapse_wrapped_table_text(details),
            collapse_wrapped_table_text(result.stdout),
        )
        self.assertGreaterEqual(len(detail_lines), 2, msg=result.stdout)
        for line in non_empty_lines:
            self.assertLessEqual(
                len(line), 34, msg=f"line exceeds max_width: {line!r}\n{result.stdout}"
            )

    def test_preserves_literal_markup_and_json_stringifies_structured_values(self):
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
        compact_meta = json.dumps(
            payload["rows"][0]["meta"],
            ensure_ascii=False,
            separators=(",", ":"),
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("[red]value[/red]", result.stdout)
        self.assertIn(compact_meta, collapse_wrapped_table_text(result.stdout))

    def test_rejects_duplicate_column_keys(self):
        payload = {
            "columns": [
                {"key": "name", "header": "Name"},
                {"key": "name", "header": "Again"},
            ],
            "rows": [],
            "options": {},
        }

        result = run_renderer(payload)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate", result.stderr.lower())

    def test_rejects_missing_rows_field(self):
        payload = {
            "columns": [{"key": "name", "header": "Name"}],
            "options": {"max_width": 34},
        }

        result = run_renderer(payload)

        self.assertNotEqual(result.returncode, 0)
        self.assertRegex(
            result.stderr.lower(),
            r"(rows.*(required|missing))|((required|missing).*rows)",
        )

    def test_returns_empty_output_for_empty_rows_without_header(self):
        payload = {
            "columns": [{"key": "name", "header": "Name"}],
            "rows": [],
            "options": {"show_header": False},
        }

        result = run_renderer(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn(result.stdout, {"", "\n"})

    def test_cli_json_path_override_renders_input_file(self):
        payload = {
            "columns": [{"key": "name", "header": "Name"}],
            "rows": [{"name": "from-file"}],
            "options": {"max_width": 20},
        }

        result = run_renderer_from_json_path(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("from-file", result.stdout)
        self.assertIn("Name", result.stdout)

    def test_missing_values_render_as_dash(self):
        payload = {
            "columns": [
                {"key": "name", "header": "Name"},
                {"key": "status", "header": "Status"},
            ],
            "rows": [{"name": "alpha"}],
            "options": {"max_width": 24},
        }

        result = run_renderer(payload)

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("alpha", result.stdout)
        self.assertRegex(result.stdout, r"Status\s*│")
        self.assertIn(" - ", result.stdout)


if __name__ == "__main__":
    unittest.main()
