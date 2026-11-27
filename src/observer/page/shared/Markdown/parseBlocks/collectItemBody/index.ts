import measureIndent from "../measureIndent/index.js";

const FENCE = /^\s*```/;

/**
 * The lines under one list item, from `start` on: every line indented past the item's marker belongs
 * to it, and so does a blank line when the next non-blank line is indented past the marker. A fenced
 * block inside the item is taken whole. Each line loses up to `contentIndent` columns of leading
 * whitespace, so the item's body reads as markdown of its own. `end` is the first line not taken. Pure.
 */
export default function collectItemBody({
	lines,
	start,
	markerIndent,
	contentIndent,
}: {
	lines: readonly string[];
	start: number;
	markerIndent: number;
	contentIndent: number;
}): { body: string[]; end: number } {
	const dedent = (line: string) => {
		let cut = 0;
		while (cut < line.length && /\s/.test(line[cut] ?? "") && measureIndent(line.slice(0, cut + 1)) <= contentIndent) cut += 1;
		return line.slice(cut);
	};

	const body: string[] = [];
	let fence = false;
	let index = start;
	for (; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (fence) {
			body.push(dedent(line));
			if (FENCE.test(line)) fence = false;
			continue;
		}
		if (line.trim() === "") {
			let next = index + 1;
			while (next < lines.length && (lines[next] ?? "").trim() === "") next += 1;
			if (next >= lines.length || measureIndent(lines[next] ?? "") <= markerIndent) break;
			body.push("");
			continue;
		}
		if (measureIndent(line) <= markerIndent) break;
		if (FENCE.test(line)) fence = true;
		body.push(dedent(line));
	}
	return { body, end: index };
}
