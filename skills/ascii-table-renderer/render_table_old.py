#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from dataclasses import dataclass
from typing import Any, List, Sequence


@dataclass(frozen=True)
class Options:
    """ASCII 表格渲染参数。"""

    fmt: str
    max_width: int
    max_col_width: int
    overflow: str
    border: str
    align: str


def parse_args(argv: Sequence[str] | None = None) -> Options:
    """解析命令行参数。"""

    p = argparse.ArgumentParser(description="Render ASCII table from JSON on stdin.")
    p.add_argument("--format", choices=["compact", "readable"], default="readable")
    p.add_argument("--max-width", type=int, default=80)
    p.add_argument("--max-col-width", type=int, default=20)
    p.add_argument("--overflow", choices=["ellipsis", "wrap"], default="ellipsis")
    p.add_argument("--border", choices=["light", "minimal"], default="light")
    p.add_argument("--align", choices=["left", "right", "center"], default="left")
    ns = p.parse_args(argv)
    return Options(
        fmt=ns.format,
        max_width=max(20, ns.max_width),
        max_col_width=max(4, ns.max_col_width),
        overflow=ns.overflow,
        border=ns.border,
        align=ns.align,
    )


def get_display_width(text: str) -> int:
    """计算字符串的实际显示宽度（支持中英文混合）。"""
    width = 0
    for char in text:
        if unicodedata.east_asian_width(char) in ('F', 'W'):
            width += 2
        else:
            width += 1
    return width


def _stringify(value: Any) -> str:
    """把值转换为可显示字符串。"""

    if value is None:
        return "-"
    return str(value)


def _truncate(text: str, width: int, use_ellipsis: bool = True) -> str:
    """按列宽截断文本（支持中英文混合）。"""

    if width <= 0:
        return ""
    if get_display_width(text) <= width:
        return text

    if use_ellipsis and width > 3:
        target_width = width - 3
        suffix = "..."
    else:
        target_width = width
        suffix = ""

    res = ""
    cur_width = 0
    for char in text:
        char_width = 2 if unicodedata.east_asian_width(char) in ('F', 'W') else 1
        if cur_width + char_width > target_width:
            break
        res += char
        cur_width += char_width
    return res + suffix


def _pad(text: str, width: int, align: str) -> str:
    """按对齐方式填充字符串到固定宽度。"""

    curr_width = get_display_width(text)
    pad_len = max(0, width - curr_width)
    if align == "right":
        return " " * pad_len + text
    if align == "center":
        left_pad = pad_len // 2
        right_pad = pad_len - left_pad
        return " " * left_pad + text + " " * right_pad
    return text + " " * pad_len


def _compute_widths(headers: List[str], rows: List[List[str]], max_col_width: int) -> List[int]:
    """计算列宽（按最大内容宽度，受 max_col_width 限制）。"""

    widths = [min(max_col_width, max(1, get_display_width(h))) for h in headers]
    for r in rows:
        for i, cell in enumerate(r):
            if i < len(widths):
                widths[i] = min(max_col_width, max(widths[i], get_display_width(cell)))
    return widths


def render_table(headers: List[str], rows: List[List[str]], opt: Options) -> str:
    """渲染 ASCII 表格。"""

    if not headers:
        return ""
    normalized_rows = [[_stringify(c) for c in row] for row in rows]
    for r in normalized_rows:
        while len(r) < len(headers):
            r.append("-")
        if len(r) > len(headers):
            del r[len(headers) :]

    widths = _compute_widths(headers, normalized_rows, opt.max_col_width)

    def cell(text: str, w: int) -> str:
        text = _truncate(text, w, use_ellipsis=(opt.overflow == "ellipsis"))
        return _pad(text, w, opt.align)

    def sep(ch: str = "-") -> str:
        if opt.border == "minimal":
            return ""
        return "+" + "+".join((ch * (w + 2)) for w in widths) + "+"

    def row_line(vals: List[str]) -> str:
        if opt.border == "minimal":
            return "  ".join(cell(v, w) for v, w in zip(vals, widths))
        return "| " + " | ".join(cell(v, w) for v, w in zip(vals, widths)) + " |"

    lines: List[str] = []
    if opt.border != "minimal":
        lines.append(sep("-"))
    lines.append(row_line(headers))
    if opt.border == "minimal":
        lines.append("-" * min(opt.max_width, max(10, sum(widths) + (len(widths) - 1) * 2)))
    else:
        lines.append(sep("-"))
    for r in normalized_rows:
        lines.append(row_line(r))
    if opt.border != "minimal" and opt.fmt == "readable":
        lines.append(sep("-"))

    out = "\n".join(lines)
    # maxWidth 只做保底截断（避免极端输入刷屏）
    final_out = "\n".join(_truncate(line, opt.max_width, False).rstrip() for line in out.splitlines()).rstrip()

    # Calculate actual width to check if table exceeds max_width
    actual_width = 0
    if opt.border == "minimal":
        actual_width = sum(widths) + (len(widths) - 1) * 2
    else:
        actual_width = sum(widths) + len(widths) * 3 + 1

    is_exceeded = actual_width > opt.max_width

    # Check if any cell content was truncated because of max_col_width
    cell_truncated = False
    max_content_width = 0
    for h in headers:
        w = get_display_width(h)
        if w > max_content_width: max_content_width = w
        if w > opt.max_col_width: cell_truncated = True
    for r in normalized_rows:
        for c in r:
            w = get_display_width(c)
            if w > max_content_width: max_content_width = w
            if w > opt.max_col_width: cell_truncated = True

    if is_exceeded or cell_truncated:
        reasons = []
        if is_exceeded:
            reasons.append(f"表格总宽度 ({actual_width}) 超出屏幕最大宽度限制 ({opt.max_width})")
        if cell_truncated:
            reasons.append(f"部分单元格内容超出了最大列宽 ({opt.max_col_width}) 导致被截断或换行")
        
        reason_str = "，且".join(reasons)
        suggested_max_col = max_content_width if cell_truncated else opt.max_col_width
        
        # Calculate suggested max width
        new_widths = [min(suggested_max_col, max(1, get_display_width(h))) for h in headers]
        for r in normalized_rows:
            for i, cell_val in enumerate(r):
                if i < len(new_widths):
                    new_widths[i] = min(suggested_max_col, max(new_widths[i], get_display_width(cell_val)))
        
        if opt.border == "minimal":
            suggested_max_w = sum(new_widths) + (len(new_widths) - 1) * 2
        else:
            suggested_max_w = sum(new_widths) + len(new_widths) * 3 + 1
            
        suggested_max_w = max(opt.max_width, suggested_max_w)
        
        cmd_args = f"--format {opt.fmt} --max-width {suggested_max_w} --max-col-width {suggested_max_col}"
        if opt.overflow != "ellipsis": cmd_args += f" --overflow {opt.overflow}"
        if opt.border != "light": cmd_args += f" --border {opt.border}"
        if opt.align != "left": cmd_args += f" --align {opt.align}"
        
        hint = (
            f"\n\n> [!NOTE]\n"
            f"> **原因**：{reason_str}。\n"
            f"> **重新调用的指令**：如需查看完整未截断的表格，请调整参数重新执行：\n"
            f"> ```bash\n"
            f"> cat data.json | python3 scripts/render_table.py {cmd_args}\n"
            f"> ```"
        )
        final_out += hint

    return final_out


def main(argv: Sequence[str] | None = None) -> int:
    """程序入口：从 stdin 读取 JSON 并输出表格。"""

    opt = parse_args(argv)
    raw = sys.stdin.read().strip()
    if not raw:
        print("Error: empty stdin. Provide JSON with headers and rows.", file=sys.stderr)
        return 1
    data = json.loads(raw)
    headers = [str(x) for x in data.get("headers", [])]
    rows = data.get("rows", [])
    if not isinstance(rows, list):
        print("Error: rows must be a list.", file=sys.stderr)
        return 1
    str_rows: List[List[str]] = [[_stringify(c) for c in (row if isinstance(row, list) else [row])] for row in rows]
    print(render_table(headers, str_rows, opt))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
