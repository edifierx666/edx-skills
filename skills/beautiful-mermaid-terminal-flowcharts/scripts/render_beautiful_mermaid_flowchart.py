#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


PACKAGE_VERSION = "1.1.3"
DISPLAY_WIDTH_SOURCE = r"""// ============================================================================
// ASCII renderer — display-width helpers for CJK-safe terminal layout
// ============================================================================

export interface DisplayGrapheme {
  value: string
  width: number
}

const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function fallbackCharWidth(char: string): number {
  const code = char.codePointAt(0)
  if (code === undefined) return 0

  if (
    (code >= 0x0300 && code <= 0x036F) ||
    (code >= 0x1AB0 && code <= 0x1AFF) ||
    (code >= 0x1DC0 && code <= 0x1DFF) ||
    (code >= 0x20D0 && code <= 0x20FF) ||
    (code >= 0xFE20 && code <= 0xFE2F)
  ) {
    return 0
  }

  if (
    (code >= 0x1100 && code <= 0x115F) ||
    (code >= 0x2E80 && code <= 0xA4CF) ||
    (code >= 0xAC00 && code <= 0xD7A3) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0xFE10 && code <= 0xFE19) ||
    (code >= 0xFE30 && code <= 0xFE6F) ||
    (code >= 0xFF00 && code <= 0xFF60) ||
    (code >= 0xFFE0 && code <= 0xFFE6) ||
    code >= 0x20000
  ) {
    return 2
  }

  return 1
}

export function displayWidth(text: string): number {
  if (!text) return 0

  if (typeof Bun !== 'undefined' && typeof Bun.stringWidth === 'function') {
    return Bun.stringWidth(text)
  }

  let total = 0
  for (const char of text) {
    total += fallbackCharWidth(char)
  }
  return total
}

export function displayGraphemes(text: string): DisplayGrapheme[] {
  if (!text) return []

  const rawParts = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), entry => entry.segment)
    : Array.from(text)

  return rawParts.map(value => ({
    value,
    width: Math.max(displayWidth(value), 0),
  }))
}
"""
RENDER_MODULE = """import { readFileSync } from 'node:fs'
import { renderMermaidASCII } from 'beautiful-mermaid'

const inputPath = process.argv[2]
const optionsJson = process.argv[3] ?? '{}'

if (!inputPath) {
  throw new Error('missing input path')
}

const source = readFileSync(inputPath, 'utf8')
const options = JSON.parse(optionsJson)
const output = renderMermaidASCII(source, options)
process.stdout.write(output)
if (!output.endsWith('\\n')) {
  process.stdout.write('\\n')
}
"""


def detect_flowchart_header(source: str) -> bool:
    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("%%"):
            continue
        lowered = line.lower()
        return lowered.startswith("flowchart ") or lowered.startswith("graph ")
    return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render terminal flowcharts with beautiful-mermaid"
    )
    parser.add_argument(
        "input", nargs="?", help="Path to Mermaid file. Reads stdin when omitted."
    )
    parser.add_argument(
        "--ascii", action="store_true", help="Use ASCII borders instead of Unicode."
    )
    parser.add_argument(
        "--padding-x", type=int, default=5, help="Horizontal spacing between nodes."
    )
    parser.add_argument(
        "--padding-y", type=int, default=5, help="Vertical spacing between nodes."
    )
    parser.add_argument(
        "--box-border-padding", type=int, default=1, help="Inner node box padding."
    )
    parser.add_argument(
        "--color-mode",
        choices=["none", "auto", "ansi16", "ansi256", "truecolor", "html"],
        default="none",
        help="Color mode passed to renderMermaidASCII.",
    )
    return parser.parse_args()


def read_source(input_path: str | None) -> str:
    if input_path:
        return Path(input_path).read_text(encoding="utf-8")
    return sys.stdin.read()


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )


def ensure_command(command: str) -> None:
    if shutil.which(command) is None:
        raise SystemExit(f"{command} is required to use this renderer")


def replace_required(text: str, old: str, new: str, file_path: Path) -> str:
    if old not in text:
        raise RuntimeError(f"patch anchor not found in {file_path}")
    return text.replace(old, new, 1)


def patch_text_file(file_path: Path, replacements: list[tuple[str, str]]) -> None:
    text = file_path.read_text(encoding="utf-8")
    for old, new in replacements:
        text = replace_required(text, old, new, file_path)
    file_path.write_text(text, encoding="utf-8")


def apply_beautiful_mermaid_patch(temp_path: Path) -> None:
    package_root = temp_path / "node_modules" / "beautiful-mermaid"
    ascii_root = package_root / "src" / "ascii"
    shapes_root = ascii_root / "shapes"

    if not ascii_root.exists():
        raise RuntimeError("beautiful-mermaid ASCII source directory not found")

    (ascii_root / "display-width.ts").write_text(DISPLAY_WIDTH_SOURCE, encoding="utf-8")

    patch_text_file(
        ascii_root / "multiline-utils.ts",
        [
            (
                "import { drawText } from './canvas.ts'\n",
                "import { drawText } from './canvas.ts'\nimport { displayWidth } from './display-width.ts'\n",
            ),
            (
                "  return Math.max(...lines.map(l => l.length), 0)\n",
                "  return Math.max(...lines.map(displayWidth), 0)\n",
            ),
            (
                "    const startX = cx - Math.floor(line.length / 2)\n",
                "    const startX = cx - Math.floor(displayWidth(line) / 2)\n",
            ),
        ],
    )

    patch_text_file(
        ascii_root / "canvas.ts",
        [
            (
                "import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'\n",
                "import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'\nimport { displayGraphemes } from './display-width.ts'\n",
            ),
            (
                """export function drawText(
  canvas: Canvas,
  start: DrawingCoord,
  text: string,
  forceOverwrite = false
): void {
  increaseSize(canvas, start.x + text.length, start.y)
  for (let i = 0; i < text.length; i++) {
    const x = start.x + i
    const current = canvas[x]![start.y]!
    // Only write if target is empty or we're forcing overwrite
    if (forceOverwrite || current === ' ') {
      canvas[x]![start.y] = text[i]!
    }
  }
}
""",
                """export function drawText(
  canvas: Canvas,
  start: DrawingCoord,
  text: string,
  forceOverwrite = false
): void {
  const graphemes = displayGraphemes(text)
  const totalWidth = graphemes.reduce((sum, item) => sum + Math.max(item.width, 0), 0)
  increaseSize(canvas, start.x + Math.max(totalWidth - 1, 0), start.y)

  let cursorX = start.x
  for (const grapheme of graphemes) {
    if (grapheme.width <= 0) continue

    const current = canvas[cursorX]![start.y]!
    if (forceOverwrite || current === ' ') {
      canvas[cursorX]![start.y] = grapheme.value
    }

    for (let offset = 1; offset < grapheme.width; offset++) {
      const fillerX = cursorX + offset
      increaseSize(canvas, fillerX, start.y)
      const fillerCurrent = canvas[fillerX]![start.y]!
      if (forceOverwrite || fillerCurrent === ' ') {
        canvas[fillerX]![start.y] = ''
      }
    }

    cursorX += grapheme.width
  }
}
""",
            ),
        ],
    )

    patch_text_file(
        ascii_root / "draw.ts",
        [
            (
                "import { splitLines } from './multiline-utils.ts'\n",
                "import { splitLines } from './multiline-utils.ts'\nimport { displayWidth } from './display-width.ts'\n",
            ),
            (
                """  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const textX = from.x + Math.floor(w / 2) - Math.ceil(line.length / 2) + 1
    for (let j = 0; j < line.length; j++) {
      if (textX + j >= 0 && textX + j < box.length && startY + i >= 0 && startY + i < box[0]!.length) {
        box[textX + j]![startY + i] = line[j]!
      }
    }
  }
""",
                """  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const textX = from.x + Math.floor(w / 2) - Math.ceil(displayWidth(line) / 2) + 1
    if (startY + i >= 0 && startY + i < box[0]!.length) {
      drawText(box, { x: textX, y: startY + i }, line, true)
    }
  }
""",
            ),
            (
                "      maxTextWidth = Math.max(maxTextWidth, line.length)\n",
                "      maxTextWidth = Math.max(maxTextWidth, displayWidth(line))\n",
            ),
            (
                """      for (let i = 0; i < line.length; i++) {
        canvas[startX + i]![row] = line[i]!
      }
""",
                """      drawText(canvas, { x: startX, y: row }, line, true)
""",
            ),
            (
                "    const startX = middleX - Math.floor(lineText.length / 2)\n",
                "    const startX = middleX - Math.floor(displayWidth(lineText) / 2)\n",
            ),
            (
                """    let labelX = Math.floor(width / 2) - Math.floor(line.length / 2)
    if (labelX < 1) labelX = 1

    for (let j = 0; j < line.length; j++) {
      if (labelX + j < width && labelY < height) {
        canvas[labelX + j]![labelY] = line[j]!
      }
    }
""",
                """    let labelX = Math.floor(width / 2) - Math.floor(displayWidth(line) / 2)
    if (labelX < 1) labelX = 1

    if (labelY < height) {
      drawText(canvas, { x: labelX, y: labelY }, line, true)
    }
""",
            ),
        ],
    )

    patch_text_file(
        ascii_root / "edge-routing.ts",
        [
            (
                "import { getEffectiveDirection, getNodeSubgraph } from './grid.ts'\n",
                "import { getEffectiveDirection, getNodeSubgraph } from './grid.ts'\nimport { displayWidth } from './display-width.ts'\n",
            ),
            (
                "  const lenLabel = edge.text.length\n",
                "  const lenLabel = displayWidth(edge.text)\n",
            ),
        ],
    )

    patch_text_file(
        shapes_root / "rectangle.ts",
        [
            (
                "import { mkCanvas } from '../canvas.ts'\n",
                "import { mkCanvas, drawText } from '../canvas.ts'\n",
            ),
            (
                "import { splitLines } from '../multiline-utils.ts'\n",
                "import { splitLines } from '../multiline-utils.ts'\nimport { displayWidth } from '../display-width.ts'\n",
            ),
            (
                "  const maxLineWidth = Math.max(...lines.map(l => l.length), 0)\n",
                "  const maxLineWidth = Math.max(...lines.map(displayWidth), 0)\n",
            ),
            (
                """    const textX = Math.floor(w / 2) - Math.ceil(line.length / 2) + 1
    for (let j = 0; j < line.length; j++) {
      const x = textX + j
      const y = startY + i
      if (x >= 0 && x < canvas.length && y >= 0 && y < canvas[0]!.length) {
        canvas[x]![y] = line[j]!
      }
    }
""",
                """    const textX = Math.floor(w / 2) - Math.ceil(displayWidth(line) / 2) + 1
    const y = startY + i
    if (y >= 0 && y < canvas[0]!.length) {
      drawText(canvas, { x: textX, y }, line, true)
    }
""",
            ),
        ],
    )

    patch_text_file(
        shapes_root / "stadium.ts",
        [
            (
                "import { mkCanvas } from '../canvas.ts'\n",
                "import { mkCanvas, drawText } from '../canvas.ts'\n",
            ),
            (
                "import { splitLines } from '../multiline-utils.ts'\n",
                "import { splitLines } from '../multiline-utils.ts'\nimport { displayWidth } from '../display-width.ts'\n",
            ),
            (
                "  const maxLineWidth = Math.max(...lines.map(l => l.length), 0)\n",
                "  const maxLineWidth = Math.max(...lines.map(displayWidth), 0)\n",
            ),
            (
                """      const textX = Math.floor(width / 2) - Math.floor(line.length / 2)
      for (let j = 0; j < line.length; j++) {
        const x = textX + j
        const y = startY + i
        if (x > 0 && x < width - 1 && y >= 0 && y < height) {
          canvas[x]![y] = line[j]!
        }
      }
""",
                """      const textX = Math.floor(width / 2) - Math.floor(displayWidth(line) / 2)
      const y = startY + i
      if (y >= 0 && y < height) {
        drawText(canvas, { x: textX, y }, line, true)
      }
""",
            ),
        ],
    )

    patch_text_file(
        shapes_root / "special.ts",
        [
            (
                "import { mkCanvas } from '../canvas.ts'\n",
                "import { mkCanvas, drawText } from '../canvas.ts'\n",
            ),
            (
                "import { splitLines } from '../multiline-utils.ts'\n",
                "import { splitLines } from '../multiline-utils.ts'\nimport { displayWidth } from '../display-width.ts'\n",
            ),
            (
                "const maxLineWidth = Math.max(...lines.map(l => l.length), 0)",
                "const maxLineWidth = Math.max(...lines.map(displayWidth), 0)",
            ),
            (
                """      const textX = Math.floor(width / 2) - Math.floor(line.length / 2)
      for (let j = 0; j < line.length; j++) {
        const x = textX + j
        const y = startY + i
        if (x > 1 && x < width - 2 && y > 0 && y < height - 1) {
          canvas[x]![y] = line[j]!
        }
      }
""",
                """      const textX = Math.floor(width / 2) - Math.floor(displayWidth(line) / 2)
      const y = startY + i
      if (y > 0 && y < height - 1) {
        drawText(canvas, { x: textX, y }, line, true)
      }
""",
            ),
            (
                """      const textX = Math.floor(width / 2) - Math.floor(line.length / 2)
      for (let j = 0; j < line.length; j++) {
        const x = textX + j
        const y = startY + i
        if (x > 0 && x < width - 1 && y > 1 && y < height - 2) {
          canvas[x]![y] = line[j]!
        }
      }
""",
                """      const textX = Math.floor(width / 2) - Math.floor(displayWidth(line) / 2)
      const y = startY + i
      if (y > 1 && y < height - 2) {
        drawText(canvas, { x: textX, y }, line, true)
      }
""",
            ),
        ],
    )


def main() -> int:
    args = parse_args()
    ensure_command("pnpm")
    ensure_command("bun")

    source = read_source(args.input)
    if not source.strip():
        raise SystemExit("empty Mermaid input")
    if not detect_flowchart_header(source):
        raise SystemExit("this renderer only supports Mermaid flowchart/graph input")

    options = {
        "useAscii": args.ascii,
        "paddingX": args.padding_x,
        "paddingY": args.padding_y,
        "boxBorderPadding": args.box_border_padding,
        "colorMode": args.color_mode,
    }

    with tempfile.TemporaryDirectory(prefix="beautiful-mermaid-flowchart-") as temp_dir:
        temp_path = Path(temp_dir)
        (temp_path / "package.json").write_text(
            '{"name":"beautiful-mermaid-flowchart","private":true}\n', encoding="utf-8"
        )
        (temp_path / "render.mjs").write_text(RENDER_MODULE, encoding="utf-8")
        input_path = temp_path / "diagram.mmd"
        input_path.write_text(source, encoding="utf-8")

        install_result = run(
            [
                "pnpm",
                "add",
                "--dir",
                str(temp_path),
                "--save-exact",
                f"beautiful-mermaid@{PACKAGE_VERSION}",
            ],
            cwd=temp_path,
        )
        if install_result.returncode != 0:
            sys.stderr.write(install_result.stderr or install_result.stdout)
            return install_result.returncode

        try:
            apply_beautiful_mermaid_patch(temp_path)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(
                f"failed to patch beautiful-mermaid for CJK-safe rendering: {exc}\n"
            )
            return 1

        render_result = run(
            [
                "bun",
                str(temp_path / "render.mjs"),
                str(input_path),
                json.dumps(options, ensure_ascii=False),
            ],
            cwd=temp_path,
        )
        if render_result.returncode != 0:
            sys.stderr.write(render_result.stderr or render_result.stdout)
            return render_result.returncode

        sys.stdout.write(render_result.stdout)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
