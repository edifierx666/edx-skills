---
name: termaid-terminal-diagrams
description: Use when Mermaid source or a requested flowchart, sequence diagram, class diagram, ER diagram, state diagram, block diagram, git graph, pie chart, treemap, or mindmap needs to be rendered directly in a terminal, SSH session, CLI output, log, or Python app, especially when browser rendering is unavailable or ASCII / themed terminal output is preferred.
license: Complete terms in LICENSE.txt
dependencies:
  - python>=3.8
  - termaid
---

## When to use this skill

- Use this skill when the user wants a diagram rendered directly in the terminal instead of a browser, PNG, or SVG.
- Use this skill when the input is Mermaid text, a `.mmd` file, or stdin that should be turned into terminal-friendly output.
- Use this skill when the user wants ASCII-only output, terminal themes, width control, or compact layout.
- Use this skill when the requested diagram is one of termaid's supported types: flowcharts, sequence, class, ER, state, block, git graphs, pie charts, treemaps, or mindmaps.
- Use this skill when the user asks what diagram types termaid supports.

**Trigger phrases include:**
- "Mermaid" / ".mmd"
- "在终端里画图" / "终端渲染流程图"
- "ASCII 图" / "纯文本图"
- "sequence diagram" / "ER diagram" / "mindmap"
- "show this Mermaid in terminal"
- "render this diagram in CLI"
- "支持哪些图表"

## Boundary

- termaid is for Mermaid-based diagrams rendered in terminal or Python output.
- If the user needs a browser-rendered image artifact, SVG export, or PNG export first, this is not the primary tool.
- If the user needs a fully manual ASCII box layout instead of Mermaid-based rendering, prefer `ascii-diagram-boxflow`.
- Pie charts are rendered as horizontal bars, not circles.
- Default output uses Unicode box-drawing characters; use `--ascii` for ASCII-only terminals.
- Supported scope is limited to: flowcharts, sequence, class, ER, state, block, git graphs, pie charts, treemaps, and mindmaps.

## Quick reference

| Need | Command |
|---|---|
| Zero-install preview | `uvx termaid diagram.mmd` |
| Render a file | `termaid diagram.mmd` |
| Render from stdin | `cat diagram.mmd | termaid` |
| Render inline Mermaid | `echo "graph LR; A-->B-->C" \| termaid` |
| ASCII-only output | `termaid diagram.mmd --ascii` |
| Theme output | `termaid diagram.mmd --theme neon` |
| Limit width | `termaid diagram.mmd --width 100` |
| Disable auto compaction | `termaid diagram.mmd --no-auto-fit` |
| Make layout tighter | `termaid diagram.mmd --gap 2 --padding-x 2 --padding-y 1` |

## How to use this skill

### Installation

- Basic install: `pip install termaid`
- Zero-install run: `uvx termaid diagram.mmd`
- Rich themes: `pip install termaid[rich]`
- Textual widget support: `pip install termaid[textual]`
- Full TUI extras: `pip install termaid[tui]`

### Input modes

#### File input
```bash
termaid diagram.mmd
```

#### Stdin input
```bash
cat diagram.mmd | termaid
```

```bash
echo "graph LR; A-->B-->C" | termaid
```

#### ASCII-only terminal
```bash
termaid diagram.mmd --ascii
```

#### Theme + width control
```bash
termaid diagram.mmd --theme neon --width 100
```

### Python usage

#### Plain string render
```python
from termaid import render

source = """
flowchart LR
  A[Start] --> B{Choice}
  B -->|Yes| C[Do it]
  B -->|No| D[Stop]
"""

print(render(source))
```

#### Rich render
```python
from rich import print as rprint
from termaid import render_rich

rprint(render_rich("graph LR\n A --> B", theme="terra"))
```

## Examples

- `examples/basic.md`

## Supported diagrams

- flowcharts
- sequence diagrams
- class diagrams
- ER diagrams
- state diagrams
- block diagrams
- git graphs
- pie charts
- treemaps
- mindmaps

## Common mistakes

1. Feeding non-Mermaid text directly into termaid instead of first expressing the diagram in Mermaid syntax.
2. Expecting pie charts to render as circles; termaid renders them as horizontal bars.
3. Using `--theme` before installing `termaid[rich]`.
4. Forgetting `--ascii` when the target terminal does not support Unicode box-drawing well.
5. Assuming any Mermaid feature is supported; keep requests inside the supported diagram list above.

## Response pattern

When this skill applies, structure the answer in this order:
1. Confirm termaid is the right fit for terminal rendering.
2. If needed, restate or generate the Mermaid source.
3. Give the exact command for file, stdin, or Python usage.
4. Mention relevant flags such as `--ascii`, `--theme`, `--width`, or `--no-auto-fit`.
5. If the user asks about coverage, list the supported diagram types.
