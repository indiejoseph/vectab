# Vectab – CLAUDE.md

## Project Overview

Vectab is a TypeScript library that converts `.vtab` files (YAML frontmatter + ASCII chord blocks) into SVG chord sheets for musicians.

## Architecture

```
src/
  types.ts      – shared TypeScript interfaces
  parser.ts     – two-stage parser (frontmatter + music blocks)
  layout.ts     – coordinate mapping engine
  renderer.ts   – SVG string generator
  index.ts      – public API (Vectab class + re-exports)
tests/
  parser.test.ts
  layout.test.ts
  renderer.test.ts
examples/
  major-tom.vtab
```

## Key Commands

```bash
bun install       # install dev deps
bun run build     # tsc → dist/
bun test          # bun native test runner
bun run dev       # tsc --watch
```

## .vtab File Format

```
---
title: "Song Title"
key: "C"
font: "Inter"
---

---
| C                | Em               |
| Ground Control to Major Tom        |
---
```

- First `---` block = YAML frontmatter (parsed manually, no external YAML deps)
- Subsequent `---` blocks = music blocks
- Each music block: first `|` line = chord line, second `|` line = lyric line (optional)

## Parsing Rules

1. Split file by lines exactly equal to `---`
2. Tabs → 4 spaces
3. Strip leading `|` from chord and lyric lines
4. Scan chord line for `|` → BarEntry positions
5. Scan chord line for non-space/non-`|` sequences → ChordEntry list
6. `totalChars` = chord line length (after stripping leading `|`)

## Layout Rules

- `x = (charIndex / totalChars) * viewboxWidth`
- Chords at y=0, lyrics at y=24 (relative to block top)
- Bar lines: y=-4 to y=36
- Block height = 60px, padding = 20px (top + left), 20px bottom

## SVG Theming

CSS variables in `<defs><style>` – color profiles: `default`, `high-contrast`, `dark`.

## Coding Conventions

- Strict TypeScript (`strict: true`)
- No external runtime dependencies (only devDependencies for build/test)
- Manual YAML frontmatter parser – no external YAML library
- Bun native test runner (Jest-compatible globals, no ts-jest needed)
