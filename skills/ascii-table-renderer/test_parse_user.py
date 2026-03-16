user_input = """  +------------+----------+----------------------+------------------+
  | 包名       | 版本     | 用途                 | 位置             |                                                                                                                  
  +------------+----------+----------------------+------------------+
  | @turf/turf | ^6.5.0   | GIS 空间分析、几何计算 | `package.json:13` |
  | ol         | ^9.1.0   | OpenLayers 地图库     | `package.json:29` |
  | ol-ext     | ^4.0.22  | OpenLayers 扩展插件   | `package.json:30` |
  +------------+----------+----------------------+------------------+"""

for line in user_input.split('\n'):
    print(repr(line))
    import unicodedata
    w = 0
    for char in line:
        if unicodedata.east_asian_width(char) in ('F', 'W'):
            w += 2
        else:
            w += 1
    print("Width:", w)
