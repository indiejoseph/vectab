# Vectab

A TypeScript library that converts `.vtab` files (YAML frontmatter + ASCII chord blocks) into beautiful SVG chord sheets for musicians.

## Features

- 📝 Simple ASCII format for chord charts
- 🎨 SVG output for crisp rendering at any size
- 🎛️ Adjustable layout (bars per line, font size, width)
- 🌙 Multiple color themes (default, high-contrast, dark)
- 📄 Print-friendly and downloadable
- ⚡ Fast parsing and rendering
- 📱 Responsive design

## Quick Start

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Run tests
bun test

# Watch for changes
bun run dev
```

## Usage

### Web Interface

Open `public/index.html` in your browser to preview and edit `.vtab` files:

```bash
# Serve locally (using any HTTP server)
python3 -m http.server 8000
```

Then visit `http://localhost:8000/public/`

### As a Library

```typescript
import { Vectab } from './dist/index.js';

const vtabSource = `---
title: "Song Title"
artist: "Artist Name"
key: "C"
---

---
| C                | Em               |
| Ground Control to Major Tom        |
---
`;

const vectab = new Vectab(vtabSource);
const svg = vectab.render({
  width: 800,
  barsPerLine: 4,
  fontSize: 14,
  colorProfile: 'default'
});

console.log(svg); // SVG string
```

## .vtab File Format

### Structure

```
---
title: "Song Title"
artist: "Artist Name"
key: "C"
---

---
## Intro
| C                | Em               | x2
---
| C                | G                |
---
## Verse
| C                | Em               |
Ground Control to Major Tom
---
```

### Syntax Rules

1. **Frontmatter** (first `---` block)
   - YAML-style metadata
   - Supports: `title`, `artist`, `key`, `fontSize`, `barsPerLine`
   - Optional color overrides: `chordColor`, `lyricColor`, `barColor`, `backgroundColor`

2. **Music Blocks** (subsequent `---` blocks)
   - First line: chord line (starts with `|`)
   - Second line: lyric line (optional)
   - Format: `| Chord1 | Chord2 | ... |`
   - Repeat marker: `| Chord | x2` (repeats 2 times, `x3`, `x4`, etc.)

3. **Section Titles**
   - Use `## Title` on the chord line for section headers

4. **Examples**

   **Simple verse:**
   ```
   ---
   | C                | Em               |
   Ground Control to Major Tom
   ---
   ```

   **Instrumental (chord-only):**
   ```
   ---
   | C | Am | F | G |
   ---
   ```

   **With repeat marker:**
   ```
   ---
   | C                | Em               | x3
   ---
   ```

   **With section title:**
   ```
   ---
   ## Verse
   | C                | Em               |
   The lyrics go here
   ---
   ```

## Render Options

```typescript
interface RenderOptions {
  width?: number;              // Canvas width in pixels (default: 800)
  barsPerLine?: number;        // Bars per line (default: 4)
  colorProfile?: 'default' | 'high-contrast' | 'dark';  // Theme
  fontSize?: number;           // Font size in pixels (default: 14)
}
```

## Color Themes

### Default
- Chords: Blue (#2563eb)
- Lyrics: Dark (#1a1a2e)
- Bars: Light gray (#ccc)
- Background: White

### High Contrast
- Chords: Black (#000)
- Lyrics: Black
- Bars: Dark gray (#444)
- Background: White

### Dark
- Chords: Cyan (#7ec8e3)
- Lyrics: Light gray (#ddd)
- Bars: Medium gray (#555)
- Background: Dark (#1a1a2e)

## Development

### Project Structure

```
src/
  types.ts      – TypeScript interfaces
  parser.ts     – YAML frontmatter + block parser
  layout.ts     – Coordinate mapping engine
  renderer.ts   – SVG string generator
  index.ts      – Public API (Vectab class)
tests/
  parser.test.ts
  layout.test.ts
  renderer.test.ts
public/
  index.html    – Interactive preview UI
```

### Key Algorithms

**Grid-Based Positioning:**
- Bars snap to a global grid for vertical alignment
- Grid size matches the number of bars being displayed
- Ensures consistent alignment across blocks with different bar counts

**Measure-Aware Row Packing:**
- Blocks distributed into rows with ≤ `barsPerLine` measures each
- Single-block rows fill entire width
- Multi-block rows proportionally sized

## API Reference

### Vectab Class

```typescript
class Vectab {
  constructor(source: string);

  parse(): ParsedVtab;
  render(options?: RenderOptions): string;
}
```

### Interfaces

```typescript
interface Frontmatter {
  title?: string;
  artist?: string;
  key?: string;
  barsPerLine?: number;
  fontSize?: number;
  chordColor?: string;
  lyricColor?: string;
  barColor?: string;
  backgroundColor?: string;
}

interface MusicBlock {
  sectionTitle?: string;      // From ## heading
  repeat?: number;            // From xN marker
  chordLine: string;
  lyricLine: string;
  chords: ChordEntry[];
  bars: BarEntry[];
  totalChars: number;
}

interface ParsedVtab {
  frontmatter: Frontmatter;
  blocks: MusicBlock[];
}
```

## Examples

See `examples/major-tom.vtab` for a complete example.

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- All tests pass: `bun test`
- Code builds: `bun run build`
- TypeScript strict mode is satisfied
