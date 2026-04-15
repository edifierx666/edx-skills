#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import dataclass, replace
from io import StringIO
from pathlib import Path
from typing import Any, Callable, Literal, Mapping, Sequence, cast

from rich import box as rich_box
from rich import cells
from rich.console import Console
from rich.table import Table
from rich.text import Text


AlignValue = Literal["left", "center", "right"]
ALIGN_OPTIONS = {"left", "center", "right"}
DEFAULT_MAX_WIDTH = 100
DEFAULT_PADDING = (0, 1)
DEFAULT_BOX_NAME = "rounded"
ASCII_BOX_NAME = "ascii"
DEFAULT_PRIORITY = 100
DEFAULT_TERMINAL_WIDTH_FALLBACK = 100
DEFAULT_CJK_SAFE = True
NATURAL_BREAK_CHARS = {" ", "\t", "/", "\\", "-", "_", "."}


class RendererError(ValueError):
    """Raised when renderer input is invalid."""


@dataclass(frozen=True)
class CliOverrides:
    """Command-line overrides for renderer options."""

    max_width: int | None
    box_name: str | None
    show_header: bool | None
    json_path: Path | None


@dataclass(frozen=True)
class TableOptions:
    """Normalized rendering options."""

    max_width: int
    box_name: str
    box_style: rich_box.Box
    show_header: bool
    show_lines: bool
    padding: tuple[int, int]
    terminal_width_fallback: int
    cjk_safe: bool


@dataclass(frozen=True)
class ColumnSpec:
    """Normalized input column definition."""

    key: str
    header: str
    align: AlignValue
    min_width: int | None
    max_width: int | None
    priority: int


@dataclass(frozen=True)
class PreparedColumn:
    """Column definition with computed layout metadata."""

    spec: ColumnSpec
    header_width: int
    content_width: int
    min_width: int
    preferred_width: int
    assigned_width: int
    minimum_render_width: int
    render_width: int


def parse_args(argv: Sequence[str] | None = None) -> CliOverrides:
    """Parse supported CLI overrides."""

    parser = argparse.ArgumentParser(description="Render a table from JSON input.")
    parser.add_argument("--max-width", type=int)
    parser.add_argument("--box")
    parser.add_argument("--no-header", action="store_true")
    parser.add_argument("--json-path")
    args = parser.parse_args(argv)
    return CliOverrides(
        max_width=_validate_positive_int(args.max_width, "max-width")
        if args.max_width is not None
        else None,
        box_name=args.box,
        show_header=False if args.no_header else None,
        json_path=Path(args.json_path) if args.json_path else None,
    )


def _validate_int(value: Any, field_name: str) -> int:
    """Validate an integer field while rejecting bool values."""

    if isinstance(value, bool) or not isinstance(value, int):
        raise RendererError(f"{field_name} must be an integer")
    return value


def _validate_non_negative_int(value: Any, field_name: str) -> int:
    """Validate a non-negative integer option."""

    value = _validate_int(value, field_name)
    if value < 0:
        raise RendererError(f"{field_name} must be >= 0")
    return value


def _validate_positive_int(value: Any, field_name: str) -> int:
    """Validate a positive integer option."""

    value = _validate_int(value, field_name)
    if value < 1:
        raise RendererError(f"{field_name} must be >= 1")
    return value


def _resolve_box(name: str) -> rich_box.Box:
    """Resolve a Rich box style by name."""

    normalized = name.strip().replace("-", "_").upper()
    if not normalized:
        raise RendererError("box must be a non-empty string")
    candidate = getattr(rich_box, normalized, None)
    if not isinstance(candidate, rich_box.Box):
        raise RendererError(f"invalid box style: {name}")
    return candidate


def _read_input_text(json_path: Path | None) -> str:
    """Read JSON text from a file or stdin."""

    if json_path is not None:
        try:
            return json_path.read_text(encoding="utf-8")
        except OSError as exc:
            raise RendererError(f"failed to read json-path: {exc}") from exc
    return sys.stdin.read()


def _parse_json(raw_text: str) -> Mapping[str, Any]:
    """Decode the top-level JSON object."""

    if not raw_text.strip():
        raise RendererError("empty input; provide JSON with columns, rows, and options")
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RendererError(f"invalid JSON: {exc.msg}") from exc
    if not isinstance(payload, dict):
        raise RendererError("top-level JSON value must be an object")
    return payload


def _normalize_options(raw_options: Any, cli: CliOverrides) -> TableOptions:
    """Merge JSON options with CLI overrides."""

    if raw_options is None:
        raw_options = {}
    if not isinstance(raw_options, dict):
        raise RendererError("options must be an object")

    show_header = raw_options.get("show_header", True)
    if not isinstance(show_header, bool):
        raise RendererError("show_header must be a boolean")

    show_lines = raw_options.get("show_lines", False)
    if not isinstance(show_lines, bool):
        raise RendererError("show_lines must be a boolean")

    cjk_safe = raw_options.get("cjk_safe", DEFAULT_CJK_SAFE)
    if not isinstance(cjk_safe, bool):
        raise RendererError("cjk_safe must be a boolean")

    padding = _normalize_padding(raw_options.get("padding", DEFAULT_PADDING))
    terminal_width_fallback = _validate_positive_int(
        raw_options.get("terminal_width_fallback", DEFAULT_TERMINAL_WIDTH_FALLBACK),
        "terminal_width_fallback",
    )

    option_box_name = raw_options.get("box", DEFAULT_BOX_NAME)
    if not isinstance(option_box_name, str):
        raise RendererError("box must be a string")
    box_name = cli.box_name if cli.box_name is not None else option_box_name
    if not isinstance(box_name, str):
        raise RendererError("box must be a string")
    box_style = _resolve_box(box_name)

    option_max_width = raw_options.get("max_width")
    if option_max_width is not None:
        option_max_width = _validate_positive_int(option_max_width, "options.max_width")

    if cli.show_header is not None:
        show_header = cli.show_header

    max_width = _resolve_target_width(
        cli.max_width, option_max_width, terminal_width_fallback
    )
    return TableOptions(
        max_width=max_width,
        box_name=box_name,
        box_style=box_style,
        show_header=show_header,
        show_lines=show_lines,
        padding=padding,
        terminal_width_fallback=terminal_width_fallback,
        cjk_safe=cjk_safe,
    )


def _normalize_padding(value: Any) -> tuple[int, int]:
    """Normalize supported padding formats."""

    if isinstance(value, bool):
        raise RendererError("padding must be an integer or [vertical, horizontal]")
    if isinstance(value, int):
        normalized = _validate_non_negative_int(value, "padding")
        return (normalized, normalized)
    if isinstance(value, (list, tuple)) and len(value) == 2:
        vertical = _validate_non_negative_int(value[0], "padding[0]")
        horizontal = _validate_non_negative_int(value[1], "padding[1]")
        return (vertical, horizontal)
    raise RendererError("padding must be an integer or [vertical, horizontal]")


def _resolve_target_width(
    cli_max_width: int | None,
    option_max_width: int | None,
    terminal_width_fallback: int,
) -> int:
    """Resolve the target render width."""

    if cli_max_width is not None:
        return cli_max_width
    if option_max_width is not None:
        return option_max_width

    terminal_width = shutil.get_terminal_size(fallback=(0, 0)).columns
    if terminal_width > 0:
        return terminal_width
    if terminal_width_fallback > 0:
        return terminal_width_fallback
    return DEFAULT_MAX_WIDTH


def _normalize_columns(raw_columns: Any, show_header: bool) -> list[ColumnSpec]:
    """Validate and normalize column definitions."""

    if not isinstance(raw_columns, list) or not raw_columns:
        raise RendererError("columns must be a non-empty array")

    columns: list[ColumnSpec] = []
    seen_keys: set[str] = set()
    for index, raw_column in enumerate(raw_columns):
        if not isinstance(raw_column, dict):
            raise RendererError(f"columns[{index}] must be an object")

        key = raw_column.get("key")
        if not isinstance(key, str) or not key:
            raise RendererError(f"columns[{index}].key must be a non-empty string")
        if key in seen_keys:
            raise RendererError(f"duplicate column key: {key}")
        seen_keys.add(key)

        raw_header = raw_column.get("header", key)
        header = key if raw_header is None else str(raw_header)

        align = raw_column.get("align", "left")
        if align not in ALIGN_OPTIONS:
            raise RendererError(
                f"columns[{index}].align must be one of {sorted(ALIGN_OPTIONS)}"
            )
        align = cast(AlignValue, align)

        priority = raw_column.get("priority", DEFAULT_PRIORITY)
        priority = _validate_int(priority, f"columns[{index}].priority")

        min_width = raw_column.get("min_width")
        max_width = raw_column.get("max_width")
        if min_width is not None:
            min_width = _validate_positive_int(min_width, f"columns[{index}].min_width")
        if max_width is not None:
            max_width = _validate_positive_int(max_width, f"columns[{index}].max_width")
        if min_width is not None and max_width is not None and min_width > max_width:
            raise RendererError(f"columns[{index}].min_width must be <= max_width")

        # Hidden headers fall back to row content width only during layout, but we still keep the label.
        if not show_header:
            header = header

        columns.append(
            ColumnSpec(
                key=key,
                header=header,
                align=align,
                min_width=min_width,
                max_width=max_width,
                priority=priority,
            )
        )
    return columns


def _normalize_rows(raw_rows: Any) -> list[dict[str, Any]]:
    """Validate object-only row input."""

    if not isinstance(raw_rows, list):
        raise RendererError("rows must be an array")

    rows: list[dict[str, Any]] = []
    for index, row in enumerate(raw_rows):
        if not isinstance(row, dict):
            raise RendererError(f"rows[{index}] must be an object")
        rows.append(row)
    return rows


def _stringify_value(value: Any) -> str:
    """Convert cell values to their renderable string form."""

    if value is None:
        return "-"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _measure_line_width(text: str) -> int:
    """Measure text width with Rich's cell model."""

    return cells.cell_len(text)


def _measure_multiline_width(text: str) -> int:
    """Measure the widest explicit line in a string."""

    return max((_measure_line_width(line) for line in text.split("\n")), default=0)


def _character_cell_width(char: str) -> int:
    """Measure one character width with a fallback for the stub Rich module."""

    get_character_cell_size = cast(
        Callable[[str], int] | None,
        getattr(cells, "get_character_cell_size", None),
    )
    if callable(get_character_cell_size):
        return int(get_character_cell_size(char))
    return max(1, _measure_line_width(char))


def _minimum_render_width(text: str) -> int:
    """Return the minimum width that can render every character without dropping content."""

    max_char_width = max((_character_cell_width(char) for char in text), default=1)
    return max(1, max_char_width)


def _text_contains_wide_glyph(text: str) -> bool:
    """Return whether text contains any double-width glyphs."""

    return any(_character_cell_width(char) > 1 for char in text)


def _resolve_ascii_box() -> rich_box.Box | None:
    """Resolve Rich's ASCII box if the active Rich implementation exposes it."""

    candidate = getattr(rich_box, "ASCII", None)
    if isinstance(candidate, rich_box.Box):
        return candidate
    return None


def _should_use_ascii_box(
    options: TableOptions,
    columns: Sequence[ColumnSpec],
    rows: Sequence[Sequence[str]],
) -> bool:
    """Decide whether wide glyph content should force ASCII borders for alignment safety."""

    if not options.cjk_safe:
        return False
    if getattr(options.box_style, "ascii", False):
        return False
    if options.show_header and any(
        _text_contains_wide_glyph(column.header) for column in columns
    ):
        return True
    return any(_text_contains_wide_glyph(cell) for row in rows for cell in row)


def _apply_cjk_safe_box(
    options: TableOptions,
    columns: Sequence[ColumnSpec],
    rows: Sequence[Sequence[str]],
) -> TableOptions:
    """Switch to ASCII borders when wide glyph content would make Unicode boxes drift."""

    if not _should_use_ascii_box(options, columns, rows):
        return options
    ascii_box = _resolve_ascii_box()
    if ascii_box is None:
        return options
    return replace(options, box_name=ASCII_BOX_NAME, box_style=ascii_box)


def _prepare_columns(
    columns: Sequence[ColumnSpec],
    rows: Sequence[Mapping[str, Any]],
    show_header: bool,
) -> tuple[list[PreparedColumn], list[list[str]]]:
    """Compute column metrics and normalized row strings."""

    normalized_rows: list[list[str]] = []
    content_widths = [0 for _ in columns]
    render_width_requirements = [1 for _ in columns]
    for row in rows:
        normalized_row: list[str] = []
        for index, column in enumerate(columns):
            text = _stringify_value(row.get(column.key))
            normalized_row.append(text)
            content_widths[index] = max(
                content_widths[index], _measure_multiline_width(text)
            )
            render_width_requirements[index] = max(
                render_width_requirements[index],
                _minimum_render_width(text),
            )
        normalized_rows.append(normalized_row)

    prepared: list[PreparedColumn] = []
    for index, column in enumerate(columns):
        header_width = _measure_multiline_width(column.header) if show_header else 0
        content_width = content_widths[index]
        preferred_width = max(header_width, content_width)
        if column.max_width is not None:
            preferred_width = min(preferred_width, column.max_width)

        if column.min_width is None:
            base_min_width = 4 if not show_header else min(max(header_width, 4), 12)
            if column.max_width is not None:
                if not show_header and column.max_width < 4:
                    min_width = column.max_width
                else:
                    min_width = min(base_min_width, column.max_width)
            else:
                min_width = base_min_width
        else:
            min_width = column.min_width

        assigned_width = max(min_width, preferred_width)
        if column.max_width is not None and assigned_width > column.max_width:
            raise RendererError(f"column {column.key} resolved width exceeds max_width")

        minimum_render_width = render_width_requirements[index]
        if show_header:
            minimum_render_width = max(
                minimum_render_width, _minimum_render_width(column.header)
            )
        render_width = max(assigned_width, minimum_render_width)

        prepared.append(
            PreparedColumn(
                spec=column,
                header_width=header_width,
                content_width=content_width,
                min_width=min_width,
                preferred_width=preferred_width,
                assigned_width=assigned_width,
                minimum_render_width=minimum_render_width,
                render_width=render_width,
            )
        )

    return prepared, normalized_rows


def _build_measurement_table(
    columns: Sequence[PreparedColumn], options: TableOptions
) -> Table:
    """Build a table with configured widths for measurement."""

    table = Table(
        box=options.box_style,
        show_header=options.show_header,
        show_lines=options.show_lines,
        padding=options.padding,
        expand=False,
    )
    for column in columns:
        table.add_column(
            column.spec.header,
            justify=cast(AlignValue, column.spec.align),
            width=column.render_width,
            overflow="fold",
            no_wrap=False,
        )
    return table


def _measure_table_width(
    columns: Sequence[PreparedColumn], options: TableOptions
) -> int:
    """Measure the rendered table width using Rich."""

    table = _build_measurement_table(columns, options)
    console_width = max(
        options.max_width, sum(column.assigned_width for column in columns) + 32
    )
    console = Console(
        width=console_width, markup=False, color_system=None, force_terminal=False
    )
    return console.measure(table).maximum


def _compress_columns(
    columns: Sequence[PreparedColumn], options: TableOptions
) -> tuple[list[PreparedColumn], int]:
    """Shrink columns until the table fits or every column hits its minimum."""

    compressed = list(columns)
    table_width = _measure_table_width(compressed, options)
    while table_width > options.max_width:
        candidates = [
            index
            for index, column in enumerate(compressed)
            if column.assigned_width > column.min_width
        ]
        if not candidates:
            break
        shrink_index = min(
            candidates,
            key=lambda index: (
                -compressed[index].spec.priority,
                -compressed[index].assigned_width,
                index,
            ),
        )
        current = compressed[shrink_index]
        next_assigned_width = current.assigned_width - 1
        compressed[shrink_index] = replace(
            current,
            assigned_width=next_assigned_width,
            render_width=max(next_assigned_width, current.minimum_render_width),
        )
        table_width = _measure_table_width(compressed, options)
    return compressed, table_width


def _find_break_offset(text: str, width: int) -> int | None:
    """Return the last natural break offset that fits within width."""

    used_width = 0
    last_break: int | None = None
    for index, char in enumerate(text):
        char_width = _measure_line_width(char)
        if used_width + char_width > width:
            break
        used_width += char_width
        if char in NATURAL_BREAK_CHARS:
            last_break = index + 1
    return last_break


def _hard_split(text: str, width: int) -> tuple[str, str]:
    """Split text with Rich's cell-aware chopping fallback."""

    pieces = [piece for piece in cells.chop_cells(text, width) if piece]
    if not pieces:
        return text, ""
    head = pieces[0]
    return head, text[len(head) :]


def wrap_cell_text(text: str, width: int) -> str:
    """Wrap cell text without ellipsis, preserving all characters."""

    if width < 1:
        return text

    wrapped_lines: list[str] = []
    for paragraph in text.split("\n"):
        if paragraph == "":
            wrapped_lines.append("")
            continue

        remaining = paragraph
        while remaining:
            if _measure_line_width(remaining) <= width:
                wrapped_lines.append(remaining)
                break
            break_offset = _find_break_offset(remaining, width)
            if break_offset is not None and break_offset > 0:
                head = remaining[:break_offset]
                tail = remaining[break_offset:]
            else:
                head, tail = _hard_split(remaining, width)
                if head == remaining:
                    wrapped_lines.append(head)
                    remaining = ""
                    break
            wrapped_lines.append(head)
            remaining = tail
    return "\n".join(wrapped_lines)


def _render_table(
    columns: Sequence[PreparedColumn],
    rows: Sequence[Sequence[str]],
    options: TableOptions,
    table_width: int,
) -> str:
    """Render the prepared table with Rich."""

    if not rows and not options.show_header:
        return ""

    render_width = (
        options.max_width if table_width <= options.max_width else table_width
    )
    buffer = StringIO()
    console = Console(
        file=buffer,
        width=render_width,
        markup=False,
        color_system=None,
        force_terminal=False,
        legacy_windows=False,
    )
    table = Table(
        box=options.box_style,
        show_header=options.show_header,
        show_lines=options.show_lines,
        padding=options.padding,
        expand=False,
    )
    for column in columns:
        header = Text(wrap_cell_text(column.spec.header, column.render_width))
        table.add_column(
            header,
            justify=cast(AlignValue, column.spec.align),
            width=column.render_width,
            overflow="fold",
            no_wrap=False,
        )

    for row in rows:
        rendered_cells = [
            Text(wrap_cell_text(cell, column.render_width))
            for cell, column in zip(row, columns)
        ]
        table.add_row(*rendered_cells)

    console.print(table)
    return buffer.getvalue().rstrip("\n")


def render_payload(payload: Mapping[str, Any], cli: CliOverrides) -> str:
    """Normalize input, compute layout, and render the table."""

    options = _normalize_options(payload.get("options"), cli)
    columns = _normalize_columns(payload.get("columns"), options.show_header)
    if "rows" not in payload:
        raise RendererError("rows field is required")
    rows = _normalize_rows(payload["rows"])
    prepared_columns, normalized_rows = _prepare_columns(
        columns, rows, options.show_header
    )
    options = _apply_cjk_safe_box(options, columns, normalized_rows)
    prepared_columns, table_width = _compress_columns(prepared_columns, options)
    return _render_table(prepared_columns, normalized_rows, options, table_width)


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point."""

    try:
        cli = parse_args(argv)
        raw_text = _read_input_text(cli.json_path)
        payload = _parse_json(raw_text)
        rendered = render_payload(payload, cli)
        if rendered:
            sys.stdout.write(rendered)
            sys.stdout.flush()
        return 0
    except RendererError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except BrokenPipeError:
        devnull_fd: int | None = None
        try:
            devnull_fd = os.open(os.devnull, os.O_WRONLY)
            os.dup2(devnull_fd, 1)
        except OSError:
            pass
        finally:
            if devnull_fd is not None:
                try:
                    os.close(devnull_fd)
                except OSError:
                    pass
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
