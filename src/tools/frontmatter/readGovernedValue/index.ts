import { parse } from "yaml";
import { GOVERNED_FIELDS, LEGACY_ALIGNMENT_KEY } from "../governedFields/index.js";
import type {
	CurrentValue,
	EditSite,
	GovernedKind,
	GovernedRead,
} from "../types/index.js";

/** One line inside the frontmatter block, addressed by offsets on the original string. */
interface BlockLine {
	/** The line's text with its terminator (`\n` or `\r\n`) removed. */
	text: string;
	/** Offset of the first character of the line. */
	start: number;
	/** Offset just past the last character of the text, terminator excluded. */
	end: number;
	/** Offset just past the line's terminator: where a new line can be inserted after this one. */
	termEnd: number;
}

/** The frontmatter block located on the original string: its YAML, its lines and where a first line can be inserted. */
interface Block {
	yaml: string;
	lines: BlockLine[];
	/** Offset right after the opening `---` line, terminator included. */
	insertAt: number;
	/** Terminator of the opening `---` line. */
	eol: "\n" | "\r\n";
}

/**
 * Finds the frontmatter block with the same rule as `parseFrontmatter`: after
 * leading whitespace (a BOM counts) the content starts with `---` and the block
 * closes at the first `\n---`. Offsets address the original string, so edits
 * computed from them keep every other byte. Returns null when there is no block.
 */
function locateBlock(content: string): Block | null {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) return null;

	const openStart = content.length - trimmed.length;
	const afterOpen = trimmed.slice(3);
	const closeIndex = afterOpen.indexOf("\n---");
	if (closeIndex === -1) return null;

	const bodyEnd = openStart + 3 + closeIndex;
	const openLineBreak = content.indexOf("\n", openStart + 3);
	const insertAt = openLineBreak + 1;
	const eol = content[openLineBreak - 1] === "\r" ? "\r\n" : "\n";

	const lines: BlockLine[] = [];
	if (insertAt <= bodyEnd) {
		let offset = insertAt;
		for (const raw of content.slice(insertAt, bodyEnd).split("\n")) {
			const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
			lines.push({
				text,
				start: offset,
				end: offset + text.length,
				termEnd: offset + raw.length + 1,
			});
			offset += raw.length + 1;
		}
	}

	// The closing \n belongs to the delimiter, so a CRLF block ends in a bare \r; normalize endings for the parser only.
	const yaml = afterOpen.slice(0, closeIndex).replace(/\r\n?/g, "\n");
	return { yaml, lines, insertAt, eol };
}

/** Narrows a parsed YAML document to a plain key-value mapping. */
function isMapping(parsed: unknown): parsed is Record<string, unknown> {
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
}

/** Whether the mapping holds the key at its top level. */
function hasKey(map: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(map, key);
}

/** Index of the first column-0 `key: …` line in the block, or -1 when no single line holds the key. */
function findKeyLine(lines: BlockLine[], key: string): number {
	const pattern = new RegExp(`^${key}:(?:[ \\t]+(.*))?$`);
	return lines.findIndex((line) => pattern.test(line.text));
}

/** The scalar text after `key:` on a line already known to match, trimmed. */
function readLineScalar(line: BlockLine, key: string): string {
	return line.text.slice(key.length + 1).trim();
}

/** Whether the line after `index` is an indented continuation of the value on line `index`. */
function continues(lines: BlockLine[], index: number): boolean {
	const next = lines[index + 1];
	return next !== undefined && /^[ \t]+\S/.test(next.text);
}

/** Edit site for a key the parser found: replace the one line that holds it, or none when it spans lines or is a block scalar. */
function locateReplace(lines: BlockLine[], index: number, key: string): EditSite {
	const line = lines[index];
	if (line === undefined) return { kind: "none", reason: "multi-line" };
	if (/^[>|]/.test(readLineScalar(line, key))) return { kind: "none", reason: "multi-line" };
	if (continues(lines, index)) return { kind: "none", reason: "multi-line" };
	return { kind: "replace", start: line.start, end: line.end };
}

/**
 * Edit site for an absent key: right after the opening `---`, except for an intent
 * spec whose first key line is a single-line `scope:`, where the new line follows
 * it (the template order is scope, alignment).
 */
function locateInsert(block: Block, kind: GovernedKind): EditSite {
	if (kind === "intent-spec") {
		const first = block.lines.findIndex((line) => /^[A-Za-z_]/.test(line.text));
		const scopeIndex = findKeyLine(block.lines, "scope");
		const scope = block.lines[scopeIndex];
		if (scope !== undefined && scopeIndex === first && locateReplace(block.lines, scopeIndex, "scope").kind === "replace") {
			return { kind: "insert", at: scope.termEnd, eol: block.eol };
		}
	}
	return { kind: "insert", at: block.insertAt, eol: block.eol };
}

/** Classifies what the key holds: a string in the kind's value set, any other present value (the parsed string, else the line text after the colon), or nothing. */
function readCurrent({
	held,
	line,
	key,
	values,
}: {
	held: unknown;
	line: BlockLine | undefined;
	key: string;
	values: readonly string[];
}): CurrentValue {
	if (typeof held === "string" && values.includes(held)) return { state: "set", value: held };
	if (typeof held === "string") return { state: "invalid", raw: held };
	const raw = line !== undefined ? readLineScalar(line, key) : String(held ?? "");
	return { state: "invalid", raw };
}

/**
 * Reads a file's governed value and says where it can be edited. Pure: it takes
 * the file's text and kind and touches nothing else, so every reader (the tool,
 * cleanup, discover, validate, scan) sees the same value, including the older
 * `status` name on an intent spec, which is read as the alignment (`legacy`) and,
 * when both names are present, flagged `ambiguous` with `current` taken from
 * `alignment`. Plans, todo lists and briefs read only `status`; an `alignment`
 * key on them is ignored. The body is never consulted: only column-0 lines inside
 * the frontmatter block are matched, and the YAML parser decides what the values
 * are. The edit site carries offsets on the original string for `rewriteFieldLine`.
 */
export default function readGovernedValue({
	content,
	kind,
}: {
	content: string;
	kind: GovernedKind;
}): GovernedRead {
	const { field, values } = GOVERNED_FIELDS[kind];

	// No block at all: the field is simply absent and there is nowhere to write it.
	const block = locateBlock(content);
	if (block === null) {
		return {
			status: "ok",
			field,
			current: { state: "not-set" },
			legacy: false,
			ambiguous: false,
			edit: { kind: "none", reason: "no-frontmatter" },
		};
	}

	// The parser decides what the keys hold; duplicate keys and bad YAML land here as errors.
	let parsed: unknown;
	try {
		parsed = parse(block.yaml);
	} catch (err) {
		return { status: "unparsable", detail: err instanceof Error ? err.message : String(err) };
	}
	if (!isMapping(parsed)) {
		return { status: "unparsable", detail: "the frontmatter is not a YAML mapping" };
	}

	// Intent specs read alignment first, then the older status name; both present is ambiguous.
	const holdsField = hasKey(parsed, field);
	const holdsLegacy = kind === "intent-spec" && hasKey(parsed, LEGACY_ALIGNMENT_KEY);
	const ambiguous = holdsField && holdsLegacy;
	const legacy = !holdsField && holdsLegacy;

	if (!holdsField && !holdsLegacy) {
		return {
			status: "ok",
			field,
			current: { state: "not-set" },
			legacy: false,
			ambiguous: false,
			edit: locateInsert(block, kind),
		};
	}

	const key = legacy ? LEGACY_ALIGNMENT_KEY : field;
	const index = findKeyLine(block.lines, key);
	return {
		status: "ok",
		field,
		current: readCurrent({ held: parsed[key], line: block.lines[index], key, values }),
		legacy,
		ambiguous,
		edit: locateReplace(block.lines, index, key),
	};
}
