import sys
# Try running render_table with the same exact arguments but wrap the Chinese words in different stuff?
import subprocess

json_data = """{
  "headers": ["包名", "版本", "归类", "说明"],
  "rows": [
    ["ol", "^9.1.0", "核心地图引擎", "OpenLayers 主库，负责地图渲染与交互"],
    ["ol-ext", "^4.0.22", "地图扩展插件", "OpenLayers 扩展控件、样式、交互能力"],
    ["@turf/turf", "^6.5.0", "GIS 空间计算", "缓冲区、裁剪、测距、点线面分析等"]
  ]
}"""

# Before
with open("test.json", "w") as f: f.write(json_data)
# Let's see if we pass string lengths somehow differently?
