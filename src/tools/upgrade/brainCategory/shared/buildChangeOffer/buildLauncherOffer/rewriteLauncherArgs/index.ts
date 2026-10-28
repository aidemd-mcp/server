import locateArgLines from "./locateArgLines/index.js";
import renderArgLine from "./renderArgLine/index.js";

/**
 * Rewrites `mcpServerConfig.args` inside a brain.aide frontmatter region from `before` to `after`
 * without reformatting anything else. Only block-list args with one scalar per line qualify
 * (anything else returns `null` so the caller can hand the replacement args to a human).
 *
 * Walks `before` and `after` with two cursors: an equal arg keeps its original source line
 * byte-for-byte; an arg only in `after` (an inserted `-y`) or replacing a `before` arg (a
 * re-pinned spec) becomes a new line in the first item's indentation, single-quoted, ending in
 * the file's line ending; a `before` arg absent from `after` is dropped. When the next `after` arg
 * equals a later `before` arg, the `before` args in between are dropped and that surviving arg
 * keeps its original source line (an npx launcher's leading args removed ahead of the vault path).
 * Bytes outside the item lines are untouched.
 */
export default function rewriteLauncherArgs({
	frontmatter,
	before,
	after,
	eol,
}: {
	frontmatter: string;
	before: (string | null)[];
	after: (string | null)[];
	eol: "\r\n" | "\n";
}): string | null {
	const lines = locateArgLines({ frontmatter, expected: before });
	if (!lines || lines.length === 0) return null;

	const first = lines[0]!;
	const last = lines[lines.length - 1]!;
	const indent = /^[ \t]*/.exec(frontmatter.slice(first.start, first.end))![0];

	let rewritten = "";
	let i = 0;
	let j = 0;
	while (i < before.length || j < after.length) {
		if (i < before.length && j < after.length && before[i] === after[j]) {
			rewritten += frontmatter.slice(lines[i]!.start, lines[i]!.end);
			i++;
			j++;
			continue;
		}

		// A before arg that survives later in `after` means the args in between were inserted.
		const survivesAt = i < before.length ? after.indexOf(before[i]!, j + 1) : -1;
		if (survivesAt !== -1) {
			while (j < survivesAt) {
				const line = renderArgLine({ indent, value: after[j++]!, eol });
				if (line === null) return null;
				rewritten += line;
			}
			continue;
		}

		// An after arg that survives from a later before position means the args in between were
		// dropped, so the surviving arg keeps its original source line.
		const keptAt = j < after.length ? before.indexOf(after[j]!, i + 1) : -1;
		if (keptAt !== -1) {
			i = keptAt;
			continue;
		}

		if (j < after.length) {
			const line = renderArgLine({ indent, value: after[j++]!, eol });
			if (line === null) return null;
			rewritten += line;
		}
		if (i < before.length) i++;
	}

	return frontmatter.slice(0, first.start) + rewritten + frontmatter.slice(last.end);
}
