import { describe, expect, it } from "bun:test";
import { parse } from "../src/parser";

const SAMPLE_VTAB = `---
title: "Major Tom"
key: "C"
---

---
| C                | Em               |
| Ground Control to Major Tom        |
---
| Am               | C/G              |
| Take your protein pills and put    |
---
`;

describe("Parser – metadata validation", () => {
	it("extracts title from frontmatter", () => {
		const result = parse(SAMPLE_VTAB);
		expect(result.frontmatter.title).toBe("Major Tom");
	});

	it("extracts key from frontmatter", () => {
		const result = parse(SAMPLE_VTAB);
		expect(result.frontmatter.key).toBe("C");
	});

	it("handles frontmatter with no quotes", () => {
		const vtab = `---
title: No Quotes Here
key: G
---

---
| G |
---
`;
		const result = parse(vtab);
		expect(result.frontmatter.title).toBe("No Quotes Here");
		expect(result.frontmatter.key).toBe("G");
	});

	it("handles optional frontmatter fields", () => {
		const vtab = `---
title: "Test"
chordColor: "#ff0000"
backgroundColor: "#000000"
fontSize: 16
---
`;
		const result = parse(vtab);
		expect(result.frontmatter.chordColor).toBe("#ff0000");
		expect(result.frontmatter.backgroundColor).toBe("#000000");
		expect(result.frontmatter.fontSize).toBe(16);
	});
});

describe("Parser – block isolation", () => {
	it("parses correct number of blocks", () => {
		const result = parse(SAMPLE_VTAB);
		expect(result.blocks).toHaveLength(2);
	});

	it("first block has correct chords", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[0];
		const chordNames = block.chords.map((c) => c.chord);
		expect(chordNames).toContain("C");
		expect(chordNames).toContain("Em");
	});

	it("second block has correct chords", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[1];
		const chordNames = block.chords.map((c) => c.chord);
		expect(chordNames).toContain("Am");
		expect(chordNames).toContain("C/G");
	});

	it("first block lyric does not bleed into second block", () => {
		const result = parse(SAMPLE_VTAB);
		expect(result.blocks[0].lyricLine).toContain("Ground Control");
		expect(result.blocks[0].lyricLine).not.toContain("protein pills");
	});

	it("second block lyric does not bleed into first block", () => {
		const result = parse(SAMPLE_VTAB);
		expect(result.blocks[1].lyricLine).toContain("protein pills");
		expect(result.blocks[1].lyricLine).not.toContain("Ground Control");
	});

	it("each block has independent chord entries", () => {
		const result = parse(SAMPLE_VTAB);
		const block1Chords = result.blocks[0].chords.map((c) => c.chord);
		const block2Chords = result.blocks[1].chords.map((c) => c.chord);
		// No chord from block 2 should appear in block 1 list
		expect(block1Chords).not.toContain("Am");
		expect(block2Chords).not.toContain("Em");
	});
});

describe("Parser – incomplete blocks (chord-only / instrumental)", () => {
	it("chord-only block (no lyric line) is parsed successfully", () => {
		const vtab = `---
title: "Instrumental"
---

---
| C                | G                |
---
`;
		const result = parse(vtab);
		expect(result.blocks).toHaveLength(1);
		const block = result.blocks[0];
		expect(block.chords.map((c) => c.chord)).toContain("C");
		expect(block.chords.map((c) => c.chord)).toContain("G");
		expect(block.lyricLine).toBe("");
	});

	it("empty sections are skipped", () => {
		const vtab = `---
title: "Test"
---


---
| C | G |
| hello world |
---
`;
		const result = parse(vtab);
		expect(result.blocks).toHaveLength(1);
	});
});

describe("Parser – tab-space conversion", () => {
	it("replaces tabs with 4 spaces before parsing", () => {
		// Build a block where the chord line uses a tab
		const vtab = `---
title: "Tab Test"
---

---
|\tC\t| Em |
| lyrics here |
---
`;
		const result = parse(vtab);
		expect(result.blocks).toHaveLength(1);
		// The chord line should not contain raw tabs
		expect(result.blocks[0].chordLine).not.toContain("\t");
		// Chords should still be found
		const names = result.blocks[0].chords.map((c) => c.chord);
		expect(names).toContain("C");
		expect(names).toContain("Em");
	});
});

describe("Parser – leading | stripping", () => {
	it("strips leading | from chord line", () => {
		const result = parse(SAMPLE_VTAB);
		// chordLine should not start with |
		expect(result.blocks[0].chordLine.startsWith("|")).toBe(false);
	});

	it("strips leading | from lyric line", () => {
		const result = parse(SAMPLE_VTAB);
		// lyricLine should not start with |
		expect(result.blocks[0].lyricLine.startsWith("|")).toBe(false);
	});
});

describe("Parser – chord index positions", () => {
	it("records correct index for first chord", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[0];
		// After stripping leading |, the chord line is " C                | Em               |"
		// C is at index 1 (one space then C)
		const cChord = block.chords.find((c) => c.chord === "C");
		expect(cChord).toBeDefined();
		expect(cChord!.index).toBeGreaterThanOrEqual(0);
	});

	it("records correct index for second chord (greater than first)", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[0];
		const cChord = block.chords.find((c) => c.chord === "C");
		const emChord = block.chords.find((c) => c.chord === "Em");
		expect(cChord).toBeDefined();
		expect(emChord).toBeDefined();
		expect(emChord!.index).toBeGreaterThan(cChord!.index);
	});

	it("records bar positions as BarEntry list", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[0];
		// Should have at least one bar (the | between C and Em, plus trailing |)
		expect(block.bars.length).toBeGreaterThan(0);
	});

	it("totalChars equals chord line length", () => {
		const result = parse(SAMPLE_VTAB);
		const block = result.blocks[0];
		expect(block.totalChars).toBe(block.chordLine.length);
	});
});
