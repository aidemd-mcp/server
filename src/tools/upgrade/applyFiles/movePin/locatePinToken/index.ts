import { isScalar, parseDocument } from "yaml";
import type { PinToken } from "@/types/index.js";

/**
 * Finds the byte range of the aide entry's pin token (the double-quoted spec
 * string at `mcpServers.aide.args[specIndex]`) in the raw config text. The pin is
 * replaced in the raw text rather than by re-serializing JSON, so indentation,
 * key order, line endings and every other server stay byte-identical; locating
 * by path (not by searching the text) means the same spec string in another
 * server's args is never touched. JSON is YAML 1.2, so `yaml`'s node ranges give
 * the exact bytes. Returns null when the token cannot be located exactly
 * (parse errors including a duplicate key, a missing path, a non-string or
 * non-double-quoted arg). Pure, never throws.
 */
export default function locatePinToken({
	raw,
	specIndex,
}: {
	raw: string;
	specIndex: number;
}): PinToken | null {
	const doc = parseDocument(raw);
	if (doc.errors.length > 0) return null;

	const node = doc.getIn(["mcpServers", "aide", "args", specIndex], true);
	if (!isScalar(node)) return null;
	if (node.type !== "QUOTE_DOUBLE") return null;
	if (typeof node.value !== "string" || !node.range) return null;

	const start = node.range[0];
	const end = node.range[1];
	const slice = raw.slice(start, end);
	if (slice.length < 2 || !slice.startsWith('"') || !slice.endsWith('"')) return null;

	return { start, end, value: node.value };
}
