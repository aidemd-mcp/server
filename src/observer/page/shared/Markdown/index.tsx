import Blocks from "./Blocks/index.js";
import parseBlocks from "./parseBlocks/index.js";

/**
 * The markdown the session record and drawer carry: paragraphs, bulleted and numbered lists (nested
 * by indentation, with `[ ]` / `[x]` checkboxes), headings, fenced code blocks, pipe tables (in a
 * wrapper that scrolls sideways on its own), `**bold**` and `` `code` ``. Built as React elements
 * from text, so raw HTML in the source prints as text and nothing in it can run. The parent supplies
 * the wrapping section.
 */
export default function Markdown({ markdown }: { markdown: string }) {
	return <Blocks blocks={parseBlocks(markdown)} />;
}
