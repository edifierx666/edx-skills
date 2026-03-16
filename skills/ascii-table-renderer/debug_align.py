import json

data = {
  "headers": ["包名", "版本", "用途", "位置"],
  "rows": [
    ["@turf/turf", "^6.5.0", "GIS 空间分析、几何计算", "`package.json:13`"],
    ["ol", "^9.1.0", "OpenLayers 地图库", "`package.json:29`"],
    ["ol-ext", "^4.0.22", "OpenLayers 扩展插件", "`package.json:30`"]
  ]
}

def print_row(row, widths):
    out = ""
    for v, w in zip(row, widths):
        out += f"| {v} ({len(v)} chars) "
    print(out)

widths = [10, 7, 20, 17]
print_row(data["headers"], widths)
for r in data["rows"]:
    print_row(r, widths)
