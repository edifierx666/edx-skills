# Understanding Code Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `understanding-code-logic` skill that forces code-understanding answers into a mental-model-first structure for project, module, page, and business-flow reading tasks.

**Architecture:** Ship one self-contained skill at `skills/understanding-code-logic/SKILL.md`. Keep the skill concise and discipline-oriented: frontmatter handles discovery, while the body enforces trigger scope, hard rules, response flow, state extraction, code explanation, and failure-mode guards. Respect repository preference by not adding tests, lint, or typecheck steps for this markdown-only change.

**Tech Stack:** Markdown, Claude skill frontmatter

---

## File Structure

- Create: `skills/understanding-code-logic/SKILL.md`
  - Single self-contained skill file.
  - Responsibility: discovery metadata, trigger scope, hard rules, response protocol, red flags, and minimal examples.
- Do not create: `examples/`, supporting references, scripts, tests
  - Reason: first version is intentionally minimal; spec explicitly allows a single-file delivery.

## Task 1: Create the skill skeleton and discovery metadata

**Files:**
- Create: `skills/understanding-code-logic/SKILL.md`

- [ ] **Step 1: Create the skill file with frontmatter and overview**

```markdown
---
name: understanding-code-logic
description: Use when understanding a codebase, module, page, or business flow before making changes, or when the user asks to explain how code or project logic works.
---

# Understanding Code Logic

## Overview

Use this skill to force code-understanding answers into a mental-model-first structure. The first answer should explain what the system is, which states matter, and how data moves before listing files, call stacks, or implementation details.
```

- [ ] **Step 2: Add the trigger scope and non-goals so this skill does not steal debug or implementation tasks**

```markdown
## When to Use

Use when the user is trying to understand a codebase, module, page, data flow, or business logic before making changes.

Typical triggers:
- "看下这个项目"
- "帮我分析这个模块"
- "读一下这段代码"
- "这个页面是怎么跑起来的"
- "先看看整体逻辑"
- "解释这段业务流程"
- "这个接口参数是怎么拼出来的"

Do not use as the primary skill for:
- debugging or root-cause analysis
- writing or changing code
- architecture planning
- tiny location-only questions with no understanding intent
```

- [ ] **Step 3: Review the partial file to confirm the discovery metadata matches the spec**

Run: `git -C /Volumes/ZY/www3/github-star-pro/edx-skills diff -- skills/understanding-code-logic/SKILL.md`
Expected: the new file contains only frontmatter, overview, and trigger scope with no placeholder text.

- [ ] **Step 4: Commit the skeleton**

```bash
git add skills/understanding-code-logic/SKILL.md
git commit -m "feat: add understanding code logic skill skeleton"
```

## Task 2: Add hard rules and the required response flow

**Files:**
- Modify: `skills/understanding-code-logic/SKILL.md`

- [ ] **Step 1: Add the non-negotiable hard rules section**

```markdown
## Hard Rules

- On the first reply, do not start with file paths, line numbers, call stacks, or a file-by-file tour.
- Do not list where the code lives before identifying the core states and data structures.
- Do not merge UI interaction state, derived values, and final request payloads into one explanation.
- Do not use "I'll scan the files" or "let's walk the tree" as a substitute for structured analysis.
- When showing code, explain every state, variable, and field. Do not leave some unexplained.
- End the first explanation with explicit follow-up options so the user can choose where to drill down next.
- Keep unverified branches and guesses out of the main business-flow explanation.
```

- [ ] **Step 2: Add the default first-reply structure**

```markdown
## Required Response Flow

For the first explanation, use this order:

1. Quick Overview
2. Core States And Data Structures
3. Plain-Language Business Flow
4. Simplified Flow Chain
5. Drill-Down Options

This is the default required order, not a suggestion.
```

- [ ] **Step 3: Add the downgrade rule for explicit location requests**

```markdown
If the user explicitly asks for location first, use this shorter pattern:
1. Give 1-2 sentences of mental-model context.
2. Then give the path, module location, call chain, or line references.
3. Do not expand the full five-part structure unless the user asks for a deeper explanation.
```

- [ ] **Step 4: Review the diff for scope drift**

Run: `git -C /Volumes/ZY/www3/github-star-pro/edx-skills diff -- skills/understanding-code-logic/SKILL.md`
Expected: the file now adds hard rules and flow order only; it does not introduce debug, planning, or implementation instructions.

- [ ] **Step 5: Commit the flow-control section**

```bash
git add skills/understanding-code-logic/SKILL.md
git commit -m "feat: add response flow for code understanding skill"
```

## Task 3: Add the state extraction and code explanation protocols

**Files:**
- Modify: `skills/understanding-code-logic/SKILL.md`

- [ ] **Step 1: Add the state extraction protocol with fixed categories and field format**

```markdown
## State Extraction Protocol

Before explaining the flow, identify the key states and structures in grouped categories such as:
- UI rendering and interaction state
- derived values
- core business logic state
- request payload and API-facing fields
- references and external dependencies

For each field, use this header format:
`字段名：大白话含义 [参考：短标识]`

For each field, list:
- where it comes from
- what its initial value or default basis is
- when it changes, if that matters

Do not repeat long paths or long URLs inside every field. Consolidate those into a short reference list at the bottom.
```

- [ ] **Step 2: Add the rule that interaction state, derived values, and payload fields must stay separated**

```markdown
Treat these as separate things even if they stay in sync:
- UI interaction state
- derived values
- final request payload

Do not collapse them into one bucket just because they are related.
```

- [ ] **Step 3: Add the code explanation protocol with one bad example and one good example**

```markdown
## Code Explanation Protocol

When code must be shown, annotate every state, variable, and field inline with `// ←` plain-language notes.

Bad:
```ts
preFromFileId, windFromFileId, temFromFileId // too vague
```

Good:
```ts
preFromFileId,  // ← 降水模型的文件 ID
windFromFileId, // ← 风场模型的文件 ID
temFromFileId,  // ← 温度模型的文件 ID
```
```

- [ ] **Step 4: Review the protocol sections for ambiguity**

Run: `git -C /Volumes/ZY/www3/github-star-pro/edx-skills diff -- skills/understanding-code-logic/SKILL.md`
Expected: the file clearly defines grouping, field format, reference consolidation, and inline code annotation rules with no `TODO` or vague placeholders.

- [ ] **Step 5: Commit the protocol sections**

```bash
git add skills/understanding-code-logic/SKILL.md
git commit -m "feat: add state and code explanation protocols"
```

## Task 4: Add failure modes, red flags, and the final polish pass

**Files:**
- Modify: `skills/understanding-code-logic/SKILL.md`

- [ ] **Step 1: Add the baseline failure modes from the no-skill test**

```markdown
## Failure Modes To Block

Watch for these defaults and block them explicitly:
- leading with file paths instead of a mental model
- dumping hook names, props, and lifecycle details before the user understands the system
- describing only function calls instead of state transitions
- skipping the state and payload inventory
- walking files in source order instead of explaining the business path
- ending without clear drill-down choices
- leaving some fields unexplained when showing code
```

- [ ] **Step 2: Add the red-flag section to resist shortcut behavior**

```markdown
## Red Flags

Stop and restructure if the answer starts to sound like:
- "Let's scan the files first"
- "The logic is in these three files"
- "I'll walk the component tree from top to bottom"
- "This is mostly handled by a hook"
- "You can read the rest in the source"

Those are signs that the explanation is drifting back to file-first output.
```

- [ ] **Step 3: Add the closing rule that the first reply must hand control back to the user**

```markdown
The first explanation should end with 2-3 concrete drill-down choices so the user can choose the next layer to inspect.
```

- [ ] **Step 4: Run the final document review pass**

Run: `git -C /Volumes/ZY/www3/github-star-pro/edx-skills diff -- skills/understanding-code-logic/SKILL.md`
Expected: the skill stays single-file, concise, and aligned with the spec: trigger scope, hard rules, response flow, state extraction, code explanation, failure modes, and red flags are all present.

- [ ] **Step 5: Commit the finished skill**

```bash
git add skills/understanding-code-logic/SKILL.md
git commit -m "feat: add understanding code logic skill"
```

## Self-Review Checklist

- Spec coverage:
  - Trigger scope covered in Task 1.
  - Hard rules and downgrade protocol covered in Task 2.
  - State extraction and inline code annotation covered in Task 3.
  - Baseline failure modes and red flags covered in Task 4.
- Placeholder scan:
  - No `TODO`, `TBD`, or vague "handle appropriately" text remains in the plan.
- Type / name consistency:
  - Skill name stays `understanding-code-logic` everywhere.
  - File path stays `skills/understanding-code-logic/SKILL.md` everywhere.
  - The five-part structure names stay consistent across all tasks.
