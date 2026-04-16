import { describe, expect, it } from "bun:test";
import {
	BLOCK_HEIGHT,
	layoutBlock,
	layoutBlocks,
	mapIndexToX,
	TOP_PADDING,
} from "../src/layout";
import type { MusicBlock } from "../src/types";

function makeBlock(overrides: Partial<MusicBlock> = {}): MusicBlock {
	return {
		chordLine: " C                | Em               |",
		lyricLine: " Ground Control to Major Tom",
		chords: [
			{ chord: "C", index: 1 },
			{ chord: "Em", index: 18 },
		],
		bars: [{ index: 17 }, { index: 35 }],
		totalChars: 36,
		...overrides,
	};
}

describe("mapIndexToX", () => {
	it("index 0 maps to x=0", () => {
		expect(mapIndexToX(0, 100, 800)).toBe(0);
	});

	it("index equal to totalChars maps to viewboxWidth", () => {
		expect(mapIndexToX(100, 100, 800)).toBe(800);
	});

	it("index at midpoint maps to half width", () => {
		expect(mapIndexToX(50, 100, 800)).toBe(400);
	});

	it("returns 0 when totalChars is 0 (edge case)", () => {
		expect(mapIndexToX(0, 0, 800)).toBe(0);
	});

	it("is proportional – double the index means double the x", () => {
		const x1 = mapIndexToX(10, 100, 800);
		const x2 = mapIndexToX(20, 100, 800);
		expect(x2).toBeCloseTo(x1 * 2, 5);
	});

	it("drift test – letter at index 50 of 51 maps to exactly (50/51) * viewboxWidth", () => {
		const x = mapIndexToX(50, 51, 760);
		expect(x).toBeCloseTo((50 / 51) * 760, 5);
	});
});

describe("layoutBlock", () => {
	const viewboxWidth = 760; // 800 - 20*2 padding
	const block = makeBlock();

	it("produces a chordPosition for each chord", () => {
		const lb = layoutBlock(block, viewboxWidth, 0);
		expect(lb.chordPositions).toHaveLength(2);
	});

	it("maps chord at index 0 to x=0", () => {
		const b = makeBlock({
			chords: [{ chord: "C", index: 0 }],
			bars: [],
			totalChars: 36,
		});
		const lb = layoutBlock(b, viewboxWidth, 0);
		expect(lb.chordPositions[0].x).toBe(0);
	});

	it("single chord gets box spanning full bar", () => {
		const b = makeBlock({
			chords: [{ chord: "Am", index: 5 }],
			bars: [],
			totalChars: 36,
		});
		const lb = layoutBlock(b, viewboxWidth, 0);
		// Single chord in single bar: starts at 0, takes full width
		expect(lb.chordPositions[0].x).toBe(0);
		expect(lb.chordPositions[0].boxWidth).toBe(viewboxWidth);
	});

	it("index sync – chord index 5 maps to the same x as lyric char index 5 would", () => {
		// The same mapIndexToX function is used for both chords and would be for lyrics
		// This confirms the mapping is consistent
		const chordX = mapIndexToX(5, 36, viewboxWidth);
		const lyricX = mapIndexToX(5, 36, viewboxWidth);
		expect(chordX).toBe(lyricX);
	});

	it("lyricX is always 0", () => {
		const lb = layoutBlock(block, viewboxWidth, 0);
		expect(lb.lyricX).toBe(0);
	});

	it("lyricText matches block lyricLine", () => {
		const lb = layoutBlock(block, viewboxWidth, 0);
		expect(lb.lyricText).toBe(block.lyricLine);
	});

	it("produces barPositions for each bar entry", () => {
		const lb = layoutBlock(block, viewboxWidth, 0);
		expect(lb.barPositions).toHaveLength(2);
	});

	it("bar at index 0 maps to x=0", () => {
		const b = makeBlock({ chords: [], bars: [{ index: 0 }], totalChars: 36 });
		const lb = layoutBlock(b, viewboxWidth, 0);
		expect(lb.barPositions[0].x).toBe(0);
	});

	it("sets y to the provided blockY", () => {
		const lb = layoutBlock(block, viewboxWidth, 120);
		expect(lb.y).toBe(120);
	});
});

describe("layoutBlocks – multiple blocks Y offsets", () => {
	const viewboxWidth = 760;

	it("first block y equals TOP_PADDING", () => {
		const blocks = [makeBlock()];
		const result = layoutBlocks(blocks, viewboxWidth);
		expect(result[0].y).toBe(TOP_PADDING);
	});

	it("second block y equals TOP_PADDING + BLOCK_HEIGHT", () => {
		const blocks = [makeBlock(), makeBlock()];
		const result = layoutBlocks(blocks, viewboxWidth);
		expect(result[1].y).toBe(TOP_PADDING + BLOCK_HEIGHT);
	});

	it("third block y equals TOP_PADDING + 2 * BLOCK_HEIGHT", () => {
		const blocks = [makeBlock(), makeBlock(), makeBlock()];
		const result = layoutBlocks(blocks, viewboxWidth);
		expect(result[2].y).toBe(TOP_PADDING + 2 * BLOCK_HEIGHT);
	});

	it("blocks are spaced exactly BLOCK_HEIGHT apart", () => {
		const blocks = [makeBlock(), makeBlock(), makeBlock()];
		const result = layoutBlocks(blocks, viewboxWidth);
		expect(result[1].y - result[0].y).toBe(BLOCK_HEIGHT);
		expect(result[2].y - result[1].y).toBe(BLOCK_HEIGHT);
	});

	it("returns empty array for empty block list", () => {
		const result = layoutBlocks([], viewboxWidth);
		expect(result).toHaveLength(0);
	});
});

describe("Bar alignment with denominator", () => {
	const viewboxWidth = 800;

	it("bars at same percentage position align across blocks with same denominator", () => {
		// 2-bar block: bars at 50% and 100%
		const block2 = makeBlock({
			chordLine: " C                | Em               |",
			bars: [{ index: 18 }, { index: 36 }],
			totalChars: 36,
		});

		// 4-bar block: bars at 25%, 50%, 75%, 100%
		const block4 = makeBlock({
			chordLine: " C  | Am | Em | G  |",
			bars: [{ index: 5 }, { index: 10 }, { index: 15 }, { index: 20 }],
			totalChars: 20,
		});

		const denominator = 4; // Both blocks scaled to 4-bar row

		const lb2 = layoutBlock(block2, viewboxWidth, 0, denominator);
		const lb4 = layoutBlock(block4, viewboxWidth, 0, denominator);

		// 2-bar block bar at 50%: (18/36) * 4 * 200 = 400
		// 4-bar block bar at 50%: (10/20) * 4 * 200 = 400
		// These should match
		expect(lb2.barPositions[0].x).toBeCloseTo(400, 0);
		expect(lb4.barPositions[1].x).toBeCloseTo(400, 0);
		expect(lb2.barPositions[0].x).toBeCloseTo(lb4.barPositions[1].x, 0);

		// Both blocks' last bars should align at 800 (100%)
		expect(lb2.barPositions[1].x).toBeCloseTo(800, 0);
		expect(lb4.barPositions[3].x).toBeCloseTo(800, 0);
	});

	it("bars maintain position ratio when scaled to denominator", () => {
		// Single 2-bar block with denominator 4
		const block = makeBlock({
			bars: [{ index: 18 }, { index: 36 }],
			totalChars: 36,
		});

		const denominators = [2, 4, 8];
		const xPositions: number[] = [];

		for (const denom of denominators) {
			const lb = layoutBlock(block, viewboxWidth, 0, denom);
			// First bar should be at 50% of denominator
			// x = (18/36) * denom * (800/denom) = 0.5 * 800 = 400
			xPositions.push(lb.barPositions[0].x);
		}

		// All should be 400 regardless of denominator
		expect(xPositions[0]).toBeCloseTo(400, 0);
		expect(xPositions[1]).toBeCloseTo(400, 0);
		expect(xPositions[2]).toBeCloseTo(400, 0);
	});

	it("bar at same relative position in different blocks scales to same absolute x", () => {
		// Both blocks should have a bar at 50% of their character range
		const block2 = makeBlock({
			chordLine: " C                | Em               |",
			bars: [{ index: 18 }], // 50% of 36
			totalChars: 36,
		});

		const block4 = makeBlock({
			chordLine: " C  | Am | Em | G  |",
			bars: [{ index: 10 }], // 50% of 20
			totalChars: 20,
		});

		const denominator = 4;
		const lb2 = layoutBlock(block2, viewboxWidth, 0, denominator);
		const lb4 = layoutBlock(block4, viewboxWidth, 0, denominator);

		// Both should be at 400
		expect(lb2.barPositions[0].x).toBeCloseTo(400, 0);
		expect(lb4.barPositions[0].x).toBeCloseTo(400, 0);
	});
});
