import type {
	BarPosition,
	ChordPosition,
	LayoutBlock,
	MusicBlock,
} from "./types";

const BLOCK_HEIGHT = 60;
const TOP_PADDING = 20;

/**
 * Map a character index in the chord line to an SVG x-coordinate.
 */
export function mapIndexToX(
	index: number,
	totalChars: number,
	viewboxWidth: number,
): number {
	if (totalChars === 0) return 0;
	return (index / totalChars) * viewboxWidth;
}

/**
 * Compute all SVG positions for a single music block using a grid system.
 *
 * @param block            Parsed music block
 * @param blockWidth       Width of this block (may be scaled)
 * @param blockY           Top y-coordinate of this block
 * @param gridSize         Number of grid cells (barsPerLine) for alignment
 * @param referenceWidth   Full width for grid calculation (default: blockWidth)
 */
export function layoutBlock(
	block: MusicBlock,
	blockWidth: number,
	blockY: number,
	gridSize: number = 4,
	referenceWidth?: number,
): LayoutBlock {
	// Use reference width for grid (ensures global alignment), then scale to block width
	const refWidth = referenceWidth ?? blockWidth;
	const globalCellWidth = refWidth / gridSize;
	const scaleFactor = blockWidth / refWidth;

	// Bar positions: snap to grid based on character position
	const barPositions: BarPosition[] = block.bars.map((b) => {
		const charPercent = b.index / block.totalChars;
		// Find nearest grid cell
		const gridCell = Math.round(charPercent * gridSize);
		return {
			x: Math.min(gridCell, gridSize) * globalCellWidth * scaleFactor,
		};
	});

	// Calculate bar start positions (including implicit bar 0 at x=0)
	const barStarts: number[] = [0];
	for (const bp of barPositions) {
		barStarts.push(bp.x);
	}

	// Calculate bar widths based on actual positions
	const barWidths: number[] = [];
	for (let i = 0; i < barStarts.length - 1; i++) {
		barWidths.push(barStarts[i + 1] - barStarts[i]);
	}
	// Last bar width: from last delimiter to end of block width
	barWidths.push(blockWidth - barStarts[barStarts.length - 1]);

	// Group chords by bar
	const barCount = barStarts.length;
	const chordsPerBar: { chord: string; index: number }[][] = Array.from(
		{ length: barCount },
		() => [],
	);
	for (const chord of block.chords) {
		// Find which bar this chord belongs to
		let barIdx = 0;
		for (let i = 0; i < block.bars.length; i++) {
			if (chord.index < block.bars[i].index) {
				barIdx = i;
				break;
			}
			barIdx = i + 1;
		}
		barIdx = Math.min(barIdx, barCount - 1);
		chordsPerBar[barIdx].push(chord);
	}

	// Create chord positions with box widths aligned to bars
	const chordPositions: ChordPosition[] = [];
	for (let barIdx = 0; barIdx < barCount; barIdx++) {
		const chords = chordsPerBar[barIdx];
		const barStartX = barStarts[barIdx];
		const barWidth = barWidths[barIdx];
		const chordsInBar = Math.max(chords.length, 1);
		const boxWidth = barWidth / chordsInBar;

		for (let i = 0; i < chords.length; i++) {
			const chord = chords[i];
			const boxStartX = barStartX + i * boxWidth;
			chordPositions.push({
				x: boxStartX,
				chord: chord.chord,
				boxWidth: boxWidth,
			});
		}
	}

	return {
		chordPositions,
		lyricText: block.lyricLine,
		lyricX: 0,
		barPositions,
		y: blockY,
	};
}

/**
 * Layout all blocks and return an array of LayoutBlock values.
 * Blocks are stacked top-to-bottom with TOP_PADDING at the start.
 */
export function layoutBlocks(
	blocks: MusicBlock[],
	viewboxWidth: number,
): LayoutBlock[] {
	return blocks.map((block, i) => {
		const blockY = TOP_PADDING + i * BLOCK_HEIGHT;
		return layoutBlock(block, viewboxWidth, blockY);
	});
}

export { BLOCK_HEIGHT, TOP_PADDING };
