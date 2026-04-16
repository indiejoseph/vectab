import { BLOCK_HEIGHT, layoutBlock, TOP_PADDING } from "./layout";
import type { Frontmatter, ParsedVtab, RenderOptions } from "./types";

const BOTTOM_PADDING = 40;
const LEFT_PADDING = 20;
const CANVAS_TOP = 40; // canvas-edge top padding (> LEFT_PADDING for more breathing room)
const A4_RATIO = 297 / 210; // portrait A4 aspect ratio

// Vertical positions within a block (relative to block top)
// y values are SVG text baselines; cap-height of a 14px font ≈ 10px
const CHORD_Y = 14; // baseline → top of chord text ≈ y=3
const LYRIC_Y = 34; // baseline → 20px below chord baseline
const BAR_Y1 = 2; // bar line top (just above chord cap)
const BAR_Y2 = 18; // bar line bottom (just below chord baseline — does not cross lyrics)

// Metadata header heights
const META_TITLE_SIZE = 28;
const META_ARTIST_SIZE = 14;
const META_KEY_SIZE = 13;
const META_HEADER_GAP = 16; // gap between last meta line and first block

// Section title (## headings)
const SECTION_TITLE_SIZE = 9; // font-size in px
const SECTION_TITLE_HEIGHT = 14; // vertical space reserved above the block

// Compact block height when there is no lyric line
const BLOCK_HEIGHT_NO_LYRIC = 28;

// Repeat marker (xN at end of chord line)
const REPEAT_AREA = 44; // pixels reserved at right edge when any block has a repeat

type ColorProfile = "default" | "high-contrast" | "dark";

interface ProfileColors {
	chordColor: string;
	lyricColor: string;
	barColor: string;
	bgColor: string;
	sectionColor: string;
}

const COLOR_PROFILES: Record<ColorProfile, ProfileColors> = {
	default: {
		chordColor: "#2563eb",
		lyricColor: "#1a1a2e",
		barColor: "#ccc",
		bgColor: "#fff",
		sectionColor: "#999",
	},
	"high-contrast": {
		chordColor: "#000",
		lyricColor: "#000",
		barColor: "#444",
		bgColor: "#fff",
		sectionColor: "#555",
	},
	dark: {
		chordColor: "#7ec8e3",
		lyricColor: "#ddd",
		barColor: "#555",
		bgColor: "#1a1a2e",
		sectionColor: "#888",
	},
};

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function buildStyle(
	profile: ProfileColors,
	frontmatter: Frontmatter,
	fontSize?: number,
): string {
	const chordColor = frontmatter.chordColor ?? profile.chordColor;
	const lyricColor = frontmatter.lyricColor ?? profile.lyricColor;
	const barColor = frontmatter.barColor ?? profile.barColor;
	const bgColor = frontmatter.backgroundColor ?? profile.bgColor;
	const sectionColor = profile.sectionColor;
	const fontFamily = "Inter, Arial, sans-serif";
	const chordSize = frontmatter.fontSize ?? fontSize ?? 14;
	const lyricSize = Math.max(chordSize - 1, 10);

	return `
    :root {
      --chord-color: ${chordColor};
      --lyric-color: ${lyricColor};
      --bar-color: ${barColor};
      --bg-color: ${bgColor};
      --section-color: ${sectionColor};
      --font-family: ${fontFamily};
      --chord-size: ${chordSize}px;
      --lyric-size: ${lyricSize}px;
    }
  `.trim();
}

/**
 * Render a ParsedVtab into a complete SVG string.
 */
export function render(
	parsed: ParsedVtab,
	options: RenderOptions = {},
): string {
	const width = options.width ?? 800;
	const profileKey: ColorProfile = options.colorProfile ?? "default";
	const profile = COLOR_PROFILES[profileKey];
	const { title, artist, key } = parsed.frontmatter;
	const barsPerLine =
		options.barsPerLine ?? parsed.frontmatter.barsPerLine ?? 4;
	const fontSize = options.fontSize;

	const contentWidth = width - LEFT_PADDING * 2;
	const hasAnyRepeat = parsed.blocks.some((b) => b.repeat !== undefined);
	// Reserve right-side space for xN markers so all rows align consistently.
	const chordContentWidth = hasAnyRepeat
		? contentWidth - REPEAT_AREA
		: contentWidth;

	// Metadata header height: title is centred (left column), artist+key are
	// right-aligned (right column). Use the taller of the two columns.
	const leftH = title ? CANVAS_TOP + META_TITLE_SIZE : 0;
	let rightH = artist || key ? CANVAS_TOP : 0;
	if (artist) rightH += META_ARTIST_SIZE + 4;
	if (key) rightH += META_KEY_SIZE + 4;
	const metaHeight =
		leftH > 0 || rightH > 0 ? Math.max(leftH, rightH) + META_HEADER_GAP : 0;

	// Pack blocks into rows so each row contains ≤ barsPerLine measures.
	// A block's measure count = block.bars.length (each | ends one measure).
	// Blocks with zero bar entries are treated as 1 measure.
	type Row = { blocks: typeof parsed.blocks; totalBars: number };
	const rows: Row[] = [];
	let currentRow: Row = { blocks: [], totalBars: 0 };

	for (const block of parsed.blocks) {
		const blockBars = Math.max(block.bars.length, 1);
		// A section title always starts a fresh row; a repeat block ends the current row
		const forceNewRow =
			currentRow.blocks.length > 0 &&
			(currentRow.totalBars + blockBars > barsPerLine || !!block.sectionTitle);
		if (forceNewRow) {
			rows.push(currentRow);
			currentRow = { blocks: [block], totalBars: blockBars };
		} else {
			currentRow.blocks.push(block);
			currentRow.totalBars += blockBars;
		}
		if (block.repeat !== undefined) {
			rows.push(currentRow);
			currentRow = { blocks: [], totalBars: 0 };
		}
	}
	if (currentRow.blocks.length > 0) rows.push(currentRow);

	// Row heights vary: compact when no block has a lyric; extra space for section titles.
	const rowHeights = rows.map((row) => {
		const hasLyric = row.blocks.some((b) => b.lyricLine.trim().length > 0);
		const base = hasLyric ? BLOCK_HEIGHT : BLOCK_HEIGHT_NO_LYRIC;
		return base + (row.blocks[0]?.sectionTitle ? SECTION_TITLE_HEIGHT : 0);
	});
	const contentHeight =
		metaHeight +
		TOP_PADDING +
		rowHeights.reduce((s, h) => s + h, 0) +
		BOTTOM_PADDING;
	const totalHeight = Math.max(Math.round(width * A4_RATIO), contentHeight);

	const style = buildStyle(profile, parsed.frontmatter, fontSize);
	const lines: string[] = [];

	lines.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">`,
	);
	lines.push(`  <defs>`);
	lines.push(`    <style>${style}</style>`);
	lines.push(`  </defs>`);
	lines.push(`  <rect width="100%" height="100%" fill="var(--bg-color)"/>`);

	// Metadata header — title centred, artist+key right-aligned
	if (title || artist || key) {
		lines.push(`  <g class="meta">`);

		if (title) {
			const titleY = CANVAS_TOP + META_TITLE_SIZE;
			lines.push(
				`    <text x="${width / 2}" y="${titleY}" text-anchor="middle" fill="var(--chord-color)" font-family="var(--font-family)" font-size="${META_TITLE_SIZE}px" font-weight="bold">${escapeXml(title)}</text>`,
			);
		}

		const rightX = width - LEFT_PADDING;
		let rightY = CANVAS_TOP;
		if (artist) {
			rightY += META_ARTIST_SIZE + 4;
			lines.push(
				`    <text x="${rightX}" y="${rightY}" text-anchor="end" fill="var(--lyric-color)" font-family="var(--font-family)" font-size="${META_ARTIST_SIZE}px" font-style="italic">${escapeXml(artist)}</text>`,
			);
		}
		if (key) {
			rightY += META_KEY_SIZE + 4;
			lines.push(
				`    <text x="${rightX}" y="${rightY}" text-anchor="end" fill="var(--lyric-color)" font-family="var(--font-family)" font-size="${META_KEY_SIZE}px">Key of ${escapeXml(key)}</text>`,
			);
		}

		lines.push(`  </g>`);
	}

	// Main content group — offset below the metadata header
	lines.push(
		`  <g class="content" transform="translate(${LEFT_PADDING}, ${metaHeight})">`,
	);

	// Render rows — each block is sized proportionally to its measure count.
	// Full rows use barsPerLine as the denominator so partial last rows don't
	// stretch; overflow rows (single block > barsPerLine) use their own count.
	let blockIndex = 0;
	let rowY = TOP_PADDING;
	for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
		const row = rows[rowIdx];
		// Single-block rows expand to fill full width; multi-block rows pack proportionally
		const denominator =
			row.blocks.length === 1
				? row.totalBars
				: Math.max(row.totalBars, barsPerLine);
		const extraH = row.blocks[0]?.sectionTitle ? SECTION_TITLE_HEIGHT : 0;
		const blockY = rowY + extraH;
		let blockX = 0;

		for (const block of row.blocks) {
			const blockBars = Math.max(block.bars.length, 1);
			// Repeat blocks always fill the full chord area so fewer bars spread wider.
			const blockWidth =
				block.repeat !== undefined
					? chordContentWidth
					: (blockBars / denominator) * chordContentWidth;
			const lb = layoutBlock(
				block,
				blockWidth,
				0,
				denominator,
				chordContentWidth,
			);

			// For repeat blocks, use natural width for chord positions (to align with verse bars)
			// but keep bar/lyric layout at full width (for stretched rendering).
			let lbForChords = lb;
			if (block.repeat !== undefined) {
				const naturalBlockWidth = (blockBars / denominator) * chordContentWidth;
				lbForChords = layoutBlock(
					block,
					naturalBlockWidth,
					0,
					denominator,
					chordContentWidth,
				);
			}

			// Section title (only on the first block of a row, before the block group)
			if (block.sectionTitle) {
				const titleY = rowY + SECTION_TITLE_HEIGHT - 6; // baseline with ~6px gap below
				lines.push(
					`    <text x="${blockX.toFixed(2)}" y="${titleY.toFixed(2)}" fill="var(--section-color)" font-family="var(--font-family)" font-size="${SECTION_TITLE_SIZE}px" font-weight="700" letter-spacing="0.08em">${escapeXml(block.sectionTitle.toUpperCase())}</text>`,
				);
			}

			lines.push(
				`    <g class="block block-${blockIndex++}" transform="translate(${blockX.toFixed(2)}, ${blockY})">`,
			);

			// Leading bar at the left edge (the | that was stripped from the chord line start)
			lines.push(
				`      <line x1="0.00" y1="${BAR_Y1}" x2="0.00" y2="${BAR_Y2}" stroke="var(--bar-color)" stroke-width="1"/>`,
			);
			// Remaining bar lines — snap the trailing | to blockWidth so it overlaps
			// exactly with the next block's leading bar (no double-bar at boundaries).
			for (let bi = 0; bi < lb.barPositions.length; bi++) {
				const bx =
					bi === lb.barPositions.length - 1
						? blockWidth // trailing bar snapped to right edge
						: lb.barPositions[bi].x;
				lines.push(
					`      <line x1="${bx.toFixed(2)}" y1="${BAR_Y1}" x2="${bx.toFixed(2)}" y2="${BAR_Y2}" stroke="var(--bar-color)" stroke-width="1"/>`,
				);
			}

			// Chord text elements, positioned in boxes (left-aligned)
			for (const cp of lbForChords.chordPositions) {
				// Chord text, left-aligned with padding (8px from box edge)
				const textX = cp.x + 8;
				lines.push(
					`      <text x="${textX.toFixed(2)}" y="${CHORD_Y}" fill="var(--chord-color)" font-family="var(--font-family)" font-size="var(--chord-size)" font-weight="bold">${escapeXml(cp.chord)}</text>`,
				);
			}

			// Lyric text element (only if there is non-whitespace content)
			const lyric = lb.lyricText.trim();
			if (lyric.length > 0) {
				lines.push(
					`      <text x="${lb.lyricX}" y="${LYRIC_Y}" fill="var(--lyric-color)" font-family="var(--font-family)" font-size="var(--lyric-size)">${escapeXml(lyric)}</text>`,
				);
			}

			lines.push(`    </g>`);
			blockX += blockWidth;

			// Repeat marker (xN) — right-aligned in the reserved repeat area
			if (block.repeat !== undefined) {
				lines.push(
					`    <text x="${contentWidth.toFixed(2)}" y="${(blockY + CHORD_Y).toFixed(2)}" text-anchor="end" fill="var(--section-color)" font-family="var(--font-family)" font-size="var(--chord-size)" font-weight="700">x${block.repeat}</text>`,
				);
			}
		}

		rowY += rowHeights[rowIdx];
	}

	lines.push(`  </g>`);
	lines.push(`</svg>`);

	return lines.join("\n");
}
