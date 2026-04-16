import { parse } from "./parser";
import { render } from "./renderer";
import type { ParsedVtab, RenderOptions } from "./types";

export class Vectab {
	constructor(private content: string) {}

	parse(): ParsedVtab {
		return parse(this.content);
	}

	render(options?: RenderOptions): string {
		const parsed = this.parse();
		return render(parsed, options);
	}
}

export { layoutBlock, layoutBlocks, mapIndexToX } from "./layout";

export { parse } from "./parser";
export { render } from "./renderer";
export type {
	BarEntry,
	BarPosition,
	ChordEntry,
	ChordPosition,
	Frontmatter,
	LayoutBlock,
	MusicBlock,
	ParsedVtab,
	RenderOptions,
} from "./types";
