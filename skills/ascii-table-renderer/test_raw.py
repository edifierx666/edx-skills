lines = [
  "  +------------+----------+----------------------+------------------+",
  "  | @turf/turf | ^6.5.0   | GIS 空间分析、几何计算 | `package.json:13` |",
  "  | ol         | ^9.1.0   | OpenLayers 地图库     | `package.json:29` |"
]
for i, l in enumerate(lines):
    print(f"Line {i} raw len: {len(l)}  str: {repr(l)}")
