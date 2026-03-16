import subprocess
import json

json_data = """{
  "headers": ["包名", "版本", "归类", "说明"],
  "rows": [
    ["ol", "^9.1.0", "核心地图引擎", "OpenLayers 主库，负责地图渲染与交互"],
    ["ol-ext", "^4.0.22", "地图扩展插件", "OpenLayers 扩展控件、样式、交互能力"],
    ["@turf/turf", "^6.5.0", "GIS 空间计算", "缓冲区、裁剪、测距、点线面分析等"]
  ]
}"""
with open("test.json", "w") as f: f.write(json_data)

out1 = subprocess.check_output("cat test.json | python3 render_table_old.py --format readable --max-width 80 --max-col-width 20", shell=True, text=True)
out2 = subprocess.check_output("cat test.json | python3 scripts/render_table.py --format readable --max-width 80 --max-col-width 20", shell=True, text=True)

if out1 == out2:
    print("THE OUTPUTS ARE EXACTLY IDENTICAL FOR DEFAULT ARGS.")
else:
    print("OUTPUT 1:")
    print(out1)
    print("\nOUTPUT 2:")
    print(out2)
