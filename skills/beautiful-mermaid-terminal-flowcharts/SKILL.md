---
name: beautiful-mermaid-terminal-flowcharts
description: Use when Mermaid flowcharts need terminal rendering via beautiful-mermaid in CLI, SSH, logs, or chat output, especially when replacing termaid with a narrower flowchart-focused terminal workflow.
---

# Beautiful Mermaid Terminal Flowcharts

## Overview

This skill replaces the old termaid-based terminal Mermaid workflow with a narrower `beautiful-mermaid` flowchart skill.

The scope is intentionally tight: terminal `flowchart` / `graph` first, `renderMermaidASCII` as the backend, and no fake promise that all Mermaid diagram families or all Chinese terminal layouts are automatically safe.

## When to Use

- Use this skill when a Mermaid flowchart needs to be rendered directly in terminal output.
- Use this skill when the user wants terminal-friendly Mermaid rendering backed by `beautiful-mermaid` instead of `termaid`.
- Use this skill when the output target is CLI, SSH, logs, or chat text rather than browser SVG.

**Trigger phrases include:**

- "beautiful-mermaid"
- "画图"
- "画流程图"
- "终端流程图" / "在终端里画流程图"
- "Mermaid 图"
- "Mermaid 流程图"
- "Mermaid flowchart in terminal"
- "ASCII flowchart"
- "用 Mermaid 在 CLI 里画流程图"

## Boundary

- This skill is intentionally for `flowchart` and `graph` terminal rendering.
- `beautiful-mermaid` supports more diagram families, but this skill does not cover sequence, class, ER, or XY charts. Keep selection tight.
- The npm package does not expose an official CLI binary. Do not tell the user to run `pnpm dlx beautiful-mermaid` directly.
- Default terminal output should use `renderMermaidASCII`, not SVG.
- Default terminal output should use `colorMode: 'none'` unless the user explicitly wants ANSI or HTML coloring.
- The bundled wrapper hot-patches `beautiful-mermaid@1.1.3` at runtime and runs it with Bun so terminal flowcharts use `Bun.stringWidth()` plus double-width canvas reservation for CJK and emoji labels.
- Chinese-heavy labels are improved by the wrapper patch, but edge-merging and complex flow layouts can still look crowded. If exact Chinese alignment is mandatory, shorten labels or fall back to a fenced plain-text diagram.
- If the user wants a browser-rendered SVG, theme previews, or rich UI embedding, this is not the primary skill.

## Quick Reference

| Need | Command |
|---|---|
| Render from stdin | `python3 /absolute/path/to/skills/beautiful-mermaid-terminal-flowcharts/scripts/render_beautiful_mermaid_flowchart.py` |
| Render from file | `python3 /absolute/path/to/skills/beautiful-mermaid-terminal-flowcharts/scripts/render_beautiful_mermaid_flowchart.py diagram.mmd` |
| ASCII-only borders | `python3 /absolute/path/to/skills/beautiful-mermaid-terminal-flowcharts/scripts/render_beautiful_mermaid_flowchart.py --ascii diagram.mmd` |
| More spacing | `python3 /absolute/path/to/skills/beautiful-mermaid-terminal-flowcharts/scripts/render_beautiful_mermaid_flowchart.py --padding-x 7 --padding-y 3 diagram.mmd` |
| Inner box padding | `python3 /absolute/path/to/skills/beautiful-mermaid-terminal-flowcharts/scripts/render_beautiful_mermaid_flowchart.py --box-border-padding 2 diagram.mmd` |

## How to Use

### Wrapper script

- `scripts/render_beautiful_mermaid_flowchart.py` bootstraps a temporary `pnpm` workspace, installs `beautiful-mermaid`, hot-patches its ASCII renderer for Bun-based display width and double-width glyph reservation, then renders with `renderMermaidASCII` through a tiny `.mjs` wrapper.
- The wrapper accepts stdin or a file path.
- The wrapper keeps `colorMode` at `none` by default so logs and chat output stay copy/paste safe.
- The wrapper rejects non-flowchart Mermaid headers so runtime behavior matches this skill's documented scope.
- The wrapper requires both `pnpm` and `bun`.
- Upgrade and patch maintenance notes live in `UPGRADE.md`.

### Supported wrapper options

- `--ascii`: switch from Unicode borders to ASCII borders
- `--padding-x <int>`: horizontal spacing between nodes
- `--padding-y <int>`: vertical spacing between nodes
- `--box-border-padding <int>`: inner padding inside node boxes
- `--color-mode <none|auto|ansi16|ansi256|truecolor|html>`: output coloring mode

### Library usage

```ts
import { renderMermaidASCII } from 'beautiful-mermaid'

const output = renderMermaidASCII(
  `flowchart TD\n  A[Start] --> B{Choice}\n  B -->|Yes| C[Ship]\n  B -->|No| D[Stop]`,
  {
    useAscii: false,
    colorMode: 'none',
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
  }
)

console.log(output)
```

## Chinese-safe authoring

- Prefer short in-diagram labels when the diagram must stay in terminal output.
- If Chinese meaning is long, use ASCII aliases in the diagram and put the full Chinese legend below it.
- If the target terminal or font is unknown, try `--ascii` first.
- The patched wrapper substantially improves raw Chinese and emoji labels compared with upstream `beautiful-mermaid@1.1.3`, but it does not rewrite graph topology. Crowded merged edges can still reduce readability.
- If the user says exact Chinese terminal alignment is required, stop escalating flags and output a fenced plain-text diagram instead.

## Examples

- `examples/basic.md`
- `examples/chinese-alias.md`

## Common Mistakes

1. Telling the user to run `pnpm dlx beautiful-mermaid`. The package has no CLI binary.
2. Expanding the skill to every Mermaid diagram family just because the library supports more than flowcharts.
3. Claiming that switching backends automatically fixes Chinese terminal alignment without the Bun patch path.
4. Emitting ANSI colors into logs or Markdown when plain text was expected.
5. Feeding natural-language prose instead of valid Mermaid syntax.

## Response Pattern

When this skill applies, structure the answer in this order:

1. Confirm the request is a flowchart and `beautiful-mermaid` is the right backend.
2. Generate the Mermaid source.
3. If labels are Chinese-heavy, warn that terminal output is best-effort and shorten labels when necessary.
4. Use the wrapper script to render terminal output with `beautiful-mermaid`.
5. Briefly explain the flags used.
6. If Chinese alignment is still wrong, switch to a fenced plain-text diagram instead of recommending endless tuning.
