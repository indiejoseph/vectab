export interface Frontmatter {
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

export interface ChordEntry {
	chord: string; // e.g. "C", "Em", "C/G"
	index: number; // character index in the chord line (after leading |)
}

export interface BarEntry {
	index: number; // character index of | in the chord line
}

export interface MusicBlock {
	sectionTitle?: string; // optional label from a ## heading line
	repeat?: number;       // optional repeat count from xN at end of chord line
	chordLine: string;     // raw chord line (minus leading |)
	lyricLine: string; // raw lyric line (minus leading |), may be empty
	chords: ChordEntry[];
	bars: BarEntry[];
	totalChars: number; // length of the chord line (for coordinate mapping)
}

export interface ParsedVtab {
	frontmatter: Frontmatter;
	blocks: MusicBlock[];
}

export interface RenderOptions {
	width?: number;        // default 800
	colorProfile?: "default" | "high-contrast" | "dark";
	barsPerLine?: number;  // default 4; overrides frontmatter value
	fontSize?: number;     // default 14; overrides frontmatter value
}

export interface ChordPosition {
	x: number;
	chord: string;
	boxWidth?: number; // width of the chord box for this position
}

export interface BarPosition {
	x: number;
}

export interface LayoutBlock {
	chordPositions: ChordPosition[];
	lyricText: string;
	lyricX: number;
	barPositions: BarPosition[];
	y: number;
}
