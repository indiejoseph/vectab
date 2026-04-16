import { beforeAll, describe, expect, it } from "bun:test";
import { Vectab } from "../src/index";
import { parse } from "../src/parser";
import { render } from "../src/renderer";

const SAMPLE_VTAB = `---
title: "Major Tom"
key: "C"
font: "Inter"
---

---
| C                | Em               |
| Ground Control to Major Tom        |
---
| Am               | C/G              |
| Take your protein pills and put    |
---
`;

const CHORD_ONLY_VTAB = `---
title: "Instrumental"
---

---
| C                | G                |
---
`;

function countOccurrences(str: string, sub: string): number {
	let count = 0;
	let pos = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((pos = str.indexOf(sub, pos)) !== -1) {
		count++;
		pos += sub.length;
	}
	return count;
}

describe("Renderer – SVG sanity", () => {
	let svg: string;

	beforeAll(() => {
		const parsed = parse(SAMPLE_VTAB);
		svg = render(parsed);
	});

	it("output contains opening <svg tag", () => {
		expect(svg).toContain("<svg");
	});

	it("output contains closing </svg> tag", () => {
		expect(svg).toContain("</svg>");
	});

	it("has exactly one opening <svg tag", () => {
		expect(countOccurrences(svg, "<svg")).toBe(1);
	});

	it("has exactly one closing </svg> tag", () => {
		expect(countOccurrences(svg, "</svg>")).toBe(1);
	});

	it("contains xmlns attribute", () => {
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
	});

	it("contains <defs> section", () => {
		expect(svg).toContain("<defs>");
		expect(svg).toContain("</defs>");
	});

	it("contains background rect", () => {
		expect(svg).toContain("<rect");
		expect(svg).toContain("var(--bg-color)");
	});

	it("all opened <g> tags are closed", () => {
		const opened = countOccurrences(svg, "<g ") + countOccurrences(svg, "<g>");
		const closed = countOccurrences(svg, "</g>");
		expect(opened).toBe(closed);
	});

	it("all opened <text> tags are closed", () => {
		const opened = countOccurrences(svg, "<text");
		const closed = countOccurrences(svg, "</text>");
		expect(opened).toBe(closed);
	});

	it("all opened <line> tags are self-closed or closed", () => {
		// <line ... /> are self-closed
		const selfClosed = countOccurrences(svg, "<line");
		const endTags = countOccurrences(svg, "</line>");
		// All lines should be self-closed (no separate </line>)
		expect(endTags).toBe(0);
		expect(selfClosed).toBeGreaterThan(0);
	});
});

describe("Renderer – correct number of <text> elements", () => {
	it("block with lyrics: chords + lyric = (numChords + 1) text elements per block", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		// Block 1: 2 chords (C, Em) + 1 lyric = 3 text elements
		// Block 2: 2 chords (Am, C/G) + 1 lyric = 3 text elements
		// Metadata: title + key = 2 text elements
		// Total = 8
		const textCount = countOccurrences(svg, "<text");
		expect(textCount).toBe(8);
	});

	it("chord-only block: only chord text elements, no lyric text element", () => {
		const parsed = parse(CHORD_ONLY_VTAB);
		const svg = render(parsed);
		// 2 chords (C, G), no lyric → 2 text elements
		// Metadata: title only (no key) → 1 text element
		// Total = 3
		const textCount = countOccurrences(svg, "<text");
		expect(textCount).toBe(3);
	});
});

describe("Renderer – lyric rendering", () => {
	it("lyric text does not have textLength attribute", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		expect(svg).not.toContain("textLength=");
	});

	it("lyric | chars are replaced with spaces, not rendered as |", () => {
		const parsed = parse(SAMPLE_VTAB);
		for (const block of parsed.blocks) {
			expect(block.lyricLine).not.toContain("|");
		}
	});
});

describe("Renderer – bar line integrity", () => {
	it("produces <line> elements for bars", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		expect(svg).toContain("<line");
	});

	it('bar lines span from y1="2" to y2="18"', () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		expect(svg).toContain('y1="2"');
		expect(svg).toContain('y2="18"');
	});

	it("bar lines use --bar-color CSS variable", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		expect(svg).toContain("var(--bar-color)");
	});

	it("number of <line> elements matches total bar count across all blocks plus one leading bar per block", () => {
		const parsed = parse(SAMPLE_VTAB);
		const totalBars = parsed.blocks.reduce((sum, b) => sum + b.bars.length, 0);
		const svg = render(parsed);
		const lineCount = countOccurrences(svg, "<line");
		// Each block gets one extra leading bar line at x=0
		expect(lineCount).toBe(totalBars + parsed.blocks.length);
	});
});

describe("Renderer – font", () => {
	it("always uses Inter as the font family", () => {
		const vtab = `---
title: "Test"
---

---
| C |
| hello |
---
`;
		const parsed = parse(vtab);
		const svg = render(parsed);
		expect(svg).toContain("Inter");
	});
});

describe("Renderer – color profiles", () => {
	it("default profile uses #2563eb for chord color", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { colorProfile: "default" });
		expect(svg).toContain("#2563eb");
	});

	it("high-contrast profile uses #000 for chord color", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { colorProfile: "high-contrast" });
		expect(svg).toContain("#000");
	});

	it("high-contrast profile chord color is #000 (not #1a1a2e)", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { colorProfile: "high-contrast" });
		// The CSS variable should be #000, not the dark blue
		const styleMatch = svg.match(/--chord-color:\s*([^;]+);/);
		expect(styleMatch).not.toBeNull();
		expect(styleMatch![1].trim()).toBe("#000");
	});

	it("dark profile uses #1a1a2e as background", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { colorProfile: "dark" });
		const styleMatch = svg.match(/--bg-color:\s*([^;]+);/);
		expect(styleMatch).not.toBeNull();
		expect(styleMatch![1].trim()).toBe("#1a1a2e");
	});

	it("dark profile uses #7ec8e3 for chord color", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { colorProfile: "dark" });
		expect(svg).toContain("#7ec8e3");
	});
});

describe("Renderer – width option", () => {
	it("default width is 800", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed);
		expect(svg).toContain('width="800"');
	});

	it("custom width is reflected in SVG", () => {
		const parsed = parse(SAMPLE_VTAB);
		const svg = render(parsed, { width: 1200 });
		expect(svg).toContain('width="1200"');
	});
});

describe("Vectab class", () => {
	it("parse() returns a ParsedVtab with frontmatter and blocks", () => {
		const vt = new Vectab(SAMPLE_VTAB);
		const parsed = vt.parse();
		expect(parsed.frontmatter.title).toBe("Major Tom");
		expect(parsed.blocks).toHaveLength(2);
	});

	it("render() returns a string containing SVG", () => {
		const vt = new Vectab(SAMPLE_VTAB);
		const svg = vt.render();
		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
	});

	it("render() accepts options", () => {
		const vt = new Vectab(SAMPLE_VTAB);
		const svg = vt.render({ colorProfile: "dark", width: 1000 });
		expect(svg).toContain('width="1000"');
		expect(svg).toContain("#7ec8e3");
	});
});
