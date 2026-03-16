import json
import unicodedata

def get_display_width(text: str) -> int:
    width = 0
    for char in text:
        if unicodedata.east_asian_width(char) in ('F', 'W'):
            width += 2
        else:
            width += 1
    return width

data = {
  "headers": ["包名", "版本", "用途", "位置"],
  "rows": [
    ["@turf/turf", "^6.5.0", "GIS 空间分析、几何计算", "`package.json:13`"],
    ["ol", "^9.1.0", "OpenLayers 地图库", "`package.json:29`"],
    ["ol-ext", "^4.0.22", "OpenLayers 扩展插件", "`package.json:30`"]
  ]
}

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

max_col_width = 20
widths = [min(max_col_width, max(1, get_display_width(h))) for h in data["headers"]]
for r in data["rows"]:
    for i, cell in enumerate(r):
        widths[i] = min(max_col_width, max(widths[i], get_display_width(cell)))

print("Widths:", widths)

for r in [data["headers"]] + data["rows"]:
    row = "| " + " | ".join(_pad(_truncate(v, w, False), w, "left") for v, w in zip(r, widths)) + " |"
    print(get_display_width(row), row)

