import { isScalar, isSeq, parseDocument } from "yaml";
import type { TokenRange } from "@/types/index.js";

/**
 * Finds the byte ranges of an MCP entry's launch tokens in the raw config text:
 * the double-quoted `command` string (quotes included) and the flow-sequence
 * `args` array (`[` through `]`) at `mcpServers.<key>`. The launch is replaced in
 * the raw text rather than by re-serializing JSON, so indentation, key order, line
 * endings and every other field and server stay byte-identical; locating by path
 * (not by searching the text) means identical strings in another server are never
 * touched. JSON is YAML 1.2, so `yaml`'s node ranges give the exact bytes. Returns
 * null when either token cannot be located exactly (parse errors including a
 * duplicate key, a missing path, a non-double-quoted command, a non-flow or
 * missing args node, or a range whose text lacks the expected delimiters). Pure,
 * never throws.
 */
export default function locateLaunchTokens({
	raw,
	key,
}: {
	raw: string;
	key: string;
}): { command: TokenRange; args: TokenRange } | null {
	const doc = parseDocument(raw);
	if (doc.errors.length > 0) return null;

	const commandNode = doc.getIn(["mcpServers", key, "command"], true);
	if (!isScalar(commandNode)) return null;
	if (commandNode.type !== "QUOTE_DOUBLE" || !commandNode.range) return null;

	const argsNode = doc.getIn(["mcpServers", key, "args"], true);
	if (!isSeq(argsNode) || !argsNode.flow || !argsNode.range) return null;

	const command = { start: commandNode.range[0], end: commandNode.range[1] };
	const args = { start: argsNode.range[0], end: argsNode.range[1] };

	const commandText = raw.slice(command.start, command.end);
	if (commandText.length < 2 || !commandText.startsWith('"') || !commandText.endsWith('"')) return null;

	const argsText = raw.slice(args.start, args.end);
	if (argsText.length < 2 || !argsText.startsWith("[") || !argsText.endsWith("]")) return null;

	return { command, args };
}
