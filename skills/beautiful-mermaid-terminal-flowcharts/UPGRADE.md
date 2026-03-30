# Beautiful Mermaid Terminal Flowcharts Upgrade Guide

## Overview

这个 skill 不是“直接调用上游包就结束”，而是：

1. 安装固定版本的 `beautiful-mermaid`
2. 对 ASCII 渲染源码做运行时热补丁
3. 用 `bun` 执行 patched 版本

所以升级不是单纯改版本号。真正要维护的是：

- 包版本
- patch 锚点
- CJK 宽度补丁是否仍覆盖完整调用链

## Current baseline

- Wrapper: `scripts/render_beautiful_mermaid_flowchart.py`
- Pinned upstream: `beautiful-mermaid@1.1.3`
- Runtime requirement: `pnpm` + `bun`
- Current patch goals:
  - `Bun.stringWidth()` 宽度计算
  - grapheme-aware 文本切分
  - 双宽字符第二列占位
  - `flowchart` / `graph` 输入边界校验

## When to upgrade

在这些情况下需要升级：

- 需要使用上游新版本功能
- 当前 patch 锚点已经跟不上上游源码
- 上游已经合并 CJK / emoji / ASCII 布局修复，想删除本地补丁
- 上游改了包导出或 ASCII 源码结构

不要为了“看起来版本旧”而机械升级。只要当前版本稳定，就没有必要追最新。

## Upgrade workflow

### 1. Read upstream package shape first

先确认新版本仍然满足两个前提：

- `bun` 条件导出仍然存在
- ASCII 源码仍然随包一起发布

参考检查命令：

```bash
tmpdir=$(mktemp -d) && \
pnpm add --dir "$tmpdir" --save-exact beautiful-mermaid@NEW_VERSION >/dev/null && \
python3 - <<'PY' "$tmpdir/node_modules/beautiful-mermaid/package.json"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(json.dumps({k: data.get(k) for k in ['version', 'exports', 'files']}, ensure_ascii=False, indent=2))
PY
```

如果 `exports["."].bun` 消失，或者 `src/ascii/` 不再随包分发，当前热补丁模型就不成立了，需要改架构而不是继续硬 patch。

### 2. Bump one constant first

只改这一处：

```python
PACKAGE_VERSION = "1.1.3"
```

位置：`scripts/render_beautiful_mermaid_flowchart.py`

先不要同时改别的逻辑。先观察新版本是否能被当前 patch 吃进去。

### 3. Run the wrapper once and look for patch-anchor failures

当前实现是 fail-fast 的：

- 找不到锚点会直接报错
- 不会静默退回坏渲染

最小运行命令：

```bash
cat <<'EOF' | python3 scripts/render_beautiful_mermaid_flowchart.py --ascii
flowchart TD
  A[进入 editReport] --> C[requestData]
  B[筛选器变更] --> C
  C --> D[/report/data]
  D --> E[data patch]
  E --> F[跳过重复刷新]
EOF
```

如果输出里出现：

- `patch anchor not found`
- `failed to patch beautiful-mermaid`

说明版本升级导致源码结构或文本片段变化，需要刷新 patch 锚点。

### 4. Refresh patch anchors file by file

当前 patch 覆盖这些文件：

- `src/ascii/multiline-utils.ts`
- `src/ascii/canvas.ts`
- `src/ascii/draw.ts`
- `src/ascii/edge-routing.ts`
- `src/ascii/shapes/rectangle.ts`
- `src/ascii/shapes/stadium.ts`
- `src/ascii/shapes/special.ts`

升级时优先检查这些热点：

- `line.length`
- `text.length`
- `Math.floor(line.length / 2)`
- `Math.ceil(line.length / 2)`
- `drawText(...)`
- `edge.text.length`

可用这个命令快速定位：

```bash
tmpdir=$(mktemp -d) && \
pnpm add --dir "$tmpdir" --save-exact beautiful-mermaid@NEW_VERSION >/dev/null && \
python3 - <<'PY' "$tmpdir/node_modules/beautiful-mermaid/src/ascii"
from pathlib import Path
import re, sys
root = Path(sys.argv[1])
patterns = [
    re.compile(r'line\.length'),
    re.compile(r'text\.length'),
    re.compile(r'label\.length'),
    re.compile(r'Math\.floor\(.*length'),
    re.compile(r'Math\.ceil\(.*length'),
    re.compile(r'drawText\('),
]
for path in sorted(root.rglob('*.ts')):
    hits = []
    for i, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if any(p.search(line) for p in patterns):
            hits.append(f'{i}: {line}')
    if hits:
        print(f'FILE {path.relative_to(root)}')
        print('\n'.join(hits))
        print()
PY
```

### 5. Keep the two-layer fix model intact

升级时不要只修一半。

必须同时确认两层仍然存在：

#### A. Width measurement

这些逻辑必须继续走 `displayWidth(...)`：

- 盒子宽度计算
- 文本居中计算
- edge label 宽度计算
- multi-line 最大宽度计算

#### B. Canvas writing

这些逻辑必须继续走 grapheme-aware + double-width reservation：

- `drawText(...)`
- 任何直接 `canvas[x][y] = line[j]` 的路径

如果你只修 A，不修 B，就会出现“盒子变宽了，但文字仍然写歪”的半修状态。

## Validation checklist

升级后至少手动跑这 4 组输入。

### 1. Pure ASCII baseline

```bash
cat <<'EOF' | python3 scripts/render_beautiful_mermaid_flowchart.py --ascii
flowchart TD
  A[Start] --> B{Choice}
  B -->|Yes| C[Ship]
  B -->|No| D[Stop]
EOF
```

目的：确认英文没有被 patch 搞坏。

### 2. Chinese node labels

```bash
cat <<'EOF' | python3 scripts/render_beautiful_mermaid_flowchart.py --ascii
flowchart TD
  A[进入 editReport] --> C[requestData]
  B[筛选器变更] --> C
  C --> D[/report/data]
  D --> E[data patch]
  E --> F[跳过重复刷新]
EOF
```

目的：确认中文框宽、居中、箭头落点正常。

### 3. Emoji + Chinese mixed labels

```bash
cat <<'EOF' | python3 scripts/render_beautiful_mermaid_flowchart.py --ascii
flowchart TD
  A[🇨🇳 中文文章] --> B[🇬🇧 英文文章]
EOF
```

目的：确认 flag emoji 没把 box width 算炸。

### 4. Negative guard: non-flowchart rejection

```bash
cat <<'EOF' | python3 scripts/render_beautiful_mermaid_flowchart.py
sequenceDiagram
  A->>B: hello
EOF
```

期望：明确报错，说明运行时边界没有被升级过程误伤。

## Failure modes

### `patch anchor not found`

含义：

- 上游文件改名
- import 排列改了
- 函数体格式改了
- 当前的字符串替换锚点不再匹配

处理方式：

- 先读新版本对应文件
- 再只更新该文件对应 replacement 片段
- 不要顺手重写整份 patch

### 渲染能跑，但中文又歪了

含义：

- 某些 `length` 热点漏掉了
- 或 `drawText(...)` 相关路径被上游重构绕开了

优先检查：

- `src/ascii/canvas.ts`
- `src/ascii/draw.ts`
- `src/ascii/shapes/*.ts`

### Node 能跑，Bun 路径没生效

当前 wrapper 强制使用 `bun` 执行 patched 模块。
如果将来有人把执行命令改回 `node render.mjs`，`Bun.stringWidth()` 快路径就失效了。

## When to remove the patch

如果未来上游满足下面三点，可以考虑删掉本地 patch：

1. 官方 ASCII 源码已经统一使用 display width，而不是 `.length`
2. 官方 `drawText` 或等价逻辑已经支持双宽字符占位
3. 中文 + emoji + mixed labels 的最小复现已经在上游版本通过

只有满足这三点，才能真的去掉本地热补丁。

## Practical rule

- 小升级：先改 `PACKAGE_VERSION`，跑复现，看锚点是否失效
- 中升级：逐文件刷新 replacement 锚点
- 大升级：如果 `src/ascii/` 结构或 `exports.bun` 消失，停止热补丁路线，改为 vendored backend 或 fork

不要把这份 wrapper 当成“升级后天然兼容”的普通封装。它本质上是一层受控 patch 系统。
