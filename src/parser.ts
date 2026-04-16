import type {
	BarEntry,
	ChordEntry,
	Frontmatter,
	MusicBlock,
	ParsedVtab,
} from "./types";

/**
 * Parse a simple YAML-like frontmatter block.
 * Supports only flat key: value pairs. No external YAML library used.
 */
function parseFrontmatter(raw: string): Frontmatter {
	const result: Frontmatter = {};
	const lines = raw.split("\n");

	for (const line of lines) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;

		const key = line.slice(0, colonIdx).trim();
		let value = line.slice(colonIdx + 1).trim();

		// Strip surrounding quotes (single or double)
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (!key || !value) continue;

		switch (key) {
			case "title":
				result.title = value;
				break;
			case "artist":
				result.artist = value;
				break;
			case "barsPerLine":
				result.barsPerLine = parseFloat(value);
				break;
			case "key":
				result.key = value;
				break;
			case "fontSize":
				result.fontSize = parseFloat(value);
				break;
			case "chordColor":
				result.chordColor = value;
				break;
			case "lyricColor":
				result.lyricColor = value;
				break;
			case "barColor":
				result.barColor = value;
				break;
			case "backgroundColor":
				result.backgroundColor = value;
				break;
		}
	}

	return result;
}

/**
 * Extract ChordEntry list and BarEntry list from a chord line
 * (with the leading `|` already stripped).
 */
function parseChordLine(chordLine: string): {
	chords: ChordEntry[];
	bars: BarEntry[];
} {
	const chords: ChordEntry[] = [];
	const bars: BarEntry[] = [];

	let i = 0;
	while (i < chordLine.length) {
		const ch = chordLine[i];

		if (ch === "|") {
			bars.push({ index: i });
			i++;
			continue;
		}

		if (ch !== " ") {
			// Start of a chord name – collect until space or |
			const start = i;
			let name = "";
			while (
				i < chordLine.length &&
				chordLine[i] !== " " &&
				chordLine[i] !== "|"
			) {
				name += chordLine[i];
				i++;
			}
			chords.push({ chord: name, index: start });
			continue;
		}

		i++;
	}

	return { chords, bars };
}

/**
 * Parse a single music block section (the raw text between two `---` delimiters,
 * excluding the delimiters themselves).
 */
function parseMusicBlock(raw: string): MusicBlock | null {
	// Replace tabs with 4 spaces
	const normalized = raw.replace(/\t/g, "    ");

	const allLines = normalized.split("\n").map((l) => l.trimEnd());

	// Optional section title: line starting with ## (before the chord line)
	let sectionTitle: string | undefined;
	for (const line of allLines) {
		const trimmed = line.trimStart();
		if (trimmed.startsWith("##")) {
			sectionTitle = trimmed.replace(/^#+\s*/, "").trim() || undefined;
			break;
		}
	}

	// First line starting with | = chord line
	const chordLineIdx = allLines.findIndex((l) => l.startsWith("|"));
	if (chordLineIdx === -1) return null;

	let chordLine = allLines[chordLineIdx].slice(1);

	// Detect repeat marker xN (e.g. "x2", "x3") after the last | in the chord line
	let repeat: number | undefined;
	const lastPipeIdx = chordLine.lastIndexOf("|");
	if (lastPipeIdx !== -1) {
		const afterPipe = chordLine.slice(lastPipeIdx + 1).trim();
		const m = afterPipe.match(/^x(\d+)$/i);
		if (m) {
			repeat = parseInt(m[1], 10);
			chordLine = chordLine.slice(0, lastPipeIdx + 1); // strip xN; keep trailing |
		}
	}

	// Lyric: next non-empty line after the chord line.
	// New format: plain text (no leading |).
	// Old format (backward compat): starts with | → strip it and replace inner | with spaces.
	let lyricLine = "";
	for (let i = chordLineIdx + 1; i < allLines.length; i++) {
		const line = allLines[i];
		if (line.trim() === "") continue;
		if (line.startsWith("|")) {
			lyricLine = line.slice(1).replace(/\|/g, " ");
		} else {
			lyricLine = line;
		}
		break;
	}

	const { chords, bars } = parseChordLine(chordLine);

	return {
		sectionTitle,
		repeat,
		chordLine,
		lyricLine,
		chords,
		bars,
		totalChars: chordLine.length,
	};
}

/**
 * Parse a complete .vtab file string into a ParsedVtab structure.
 */
export function parse(content: string): ParsedVtab {
	// Normalize line endings
	const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	// Split on lines that are exactly `---`
	const sections = normalized.split(/^---$/m);

	// sections[0] is anything before the first `---` (usually empty)
	// sections[1] is the frontmatter
	// sections[2+] are alternating: between-block gaps and block contents

	let frontmatter: Frontmatter = {};
	const blocks: MusicBlock[] = [];

	if (sections.length < 2) {
		return { frontmatter, blocks };
	}

	// First section after opening `---` is frontmatter
	frontmatter = parseFrontmatter(sections[1]);

	// Remaining sections: they come in pairs because each block is wrapped in `---`
	// e.g. sections[2] = "\n" (gap), sections[3] = block content, sections[4] = "\n", ...
	// But the actual layout after splitting is:
	//   ---        ← delimiter
	//   frontmatter content
	//   ---        ← delimiter
	//   (empty/whitespace between blocks)
	//   ---        ← delimiter
	//   block content
	//   ---        ← delimiter
	//
	// So sections after frontmatter (index >= 2) that have | lines are block content.
	for (let i = 2; i < sections.length; i++) {
		const section = sections[i];
		const block = parseMusicBlock(section);
		if (block !== null) {
			blocks.push(block);
		}
	}

	return { frontmatter, blocks };
}
