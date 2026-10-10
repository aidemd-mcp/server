import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { ArgLine } from "@/types/index.js";

/**
 * Locates every item of `mcpServerConfig.args` as a whole source line, or returns `null` when the
 * layout is not one the rewrite can touch byte-safely: not a block sequence, a non-scalar item, an
 * item spanning several lines, an item whose line carries more than the `- ` marker and its
 * scalar (comments aside), a gap between item lines, or a value that differs from `expected`.
 */
export default function locateArgLines({ frontmatter, expected }: { frontmatter: string; expected: (string | null)[] }): ArgLine[] | null {
	const doc = parseDocument(frontmatter);
	if (doc.errors.length > 0) return null;
	const server = doc.get("mcpServerConfig", true);
	if (!isMap(server)) return null;
	const args = server.get("args", true);
	if (!isSeq(args) || args.flow || args.items.length !== expected.length) return null;

	const lines: ArgLine[] = [];
	for (const [index, item] of args.items.entries()) {
		if (!isScalar(item) || !item.range) return null;
		if (typeof item.value !== "string" && item.value !== null) return null;
		if (item.value !== expected[index]) return null;

		const [scalarStart, scalarEnd] = item.range;
		if (frontmatter.slice(scalarStart, scalarEnd).includes("\n")) return null;

		// The scalar of a bare `-` item can start after the dash's line break, so the line is
		// anchored on the dash that precedes the scalar rather than on the scalar itself.
		const dash = frontmatter.lastIndexOf("-", item.value === null ? scalarStart : scalarStart - 1);
		const start = frontmatter.lastIndexOf("\n", dash) + 1;
		const lineBreak = frontmatter.indexOf("\n", dash);
		if (lineBreak === -1) return null;
		const end = lineBreak + 1;

		const line = frontmatter.slice(start, end);
		const shape = item.value === null ? /^[ \t]*-[ \t]*(#[^\r\n]*)?\r?\n$/ : /^[ \t]*-[ \t]+\S/;
		if (!shape.test(line)) return null;
		if (item.value !== null && frontmatter.slice(start, dash).trim() !== "") return null;
		lines.push({ start, end, value: item.value });
	}

	for (let i = 1; i < lines.length; i++) if (lines[i]!.start !== lines[i - 1]!.end) return null;
	return lines;
}
