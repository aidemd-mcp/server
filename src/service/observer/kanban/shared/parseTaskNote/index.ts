import { parse } from "yaml";
import type { BoardColumnId, BoardTask } from "@/service/observer/kanban/types/index.js";

/** The priorities a task note may carry. */
const PRIORITIES = ["p0", "p1", "p2", "p3"] as const;

/** A task with no priority is treated as p2 (brain kanban guide). */
const DEFAULT_PRIORITY = "p2";

/** Splits the text between a leading `---` line and the next `---` line; null when there is no block. */
function extractBlock(markdown: string): { block: string; body: string } | null {
	const match = /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/.exec(markdown);
	if (!match) return null;
	return { block: match[1], body: match[2] ?? "" };
}

/** Coerces the frontmatter `tags` value to strings: a list keeps its strings, one string becomes one tag. */
function toTags(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
	if (typeof value === "string") return [value.replace(/^#/, "")];
	return [];
}

/** Renders the frontmatter `updated` value as a string; YAML may have parsed it into a Date. */
function toUpdated(value: unknown): string | undefined {
	if (value instanceof Date) return value.toISOString().slice(0, 19);
	if (typeof value === "string") return value;
	return undefined;
}

/**
 * Parses one kanban task note into a board task. A note without a parseable frontmatter mapping is
 * `unreadable` with the reason; a missing title or unknown priority falls back (slug, p2) and stays readable. Never throws.
 */
export default function parseTaskNote({
	slug,
	column,
	markdown,
	inSession,
}: {
	slug: string;
	column: BoardColumnId;
	markdown: string;
	inSession: boolean;
}): BoardTask {
	const unreadable = (reason: string): BoardTask => ({ state: "unreadable", slug, column, reason, inSession });

	const extracted = extractBlock(markdown);
	if (!extracted) return unreadable("no frontmatter");

	let parsed: unknown;
	try {
		parsed = parse(extracted.block);
	} catch (error) {
		return unreadable(`frontmatter does not parse: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return unreadable("frontmatter is not a mapping");
	}
	const frontmatter = parsed as Record<string, unknown>;

	const heading = extracted.body.split(/\r?\n/).find((line) => line.startsWith("# "));
	const priority = PRIORITIES.find((candidate) => candidate === frontmatter.priority) ?? DEFAULT_PRIORITY;
	const updated = toUpdated(frontmatter.updated);

	return {
		state: "readable",
		slug,
		column,
		title: heading ? heading.slice(2).trim() : slug,
		priority,
		...(typeof frontmatter.type === "string" && frontmatter.type !== "" ? { type: frontmatter.type } : {}),
		tags: toTags(frontmatter.tags),
		...(updated !== undefined ? { updated } : {}),
		inSession,
	};
}
