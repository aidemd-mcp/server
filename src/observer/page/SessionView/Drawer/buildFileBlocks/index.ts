import { parse } from "yaml";
import type { DrawerBlockModel } from "@/observer/page/types/index.js";

/** A frontmatter value as the table prints it: a list for arrays, one row per key for nested maps (`outcomes.desired`), text otherwise. */
function toRows(key: string, value: unknown): { key: string; value: string; list: string[] | null }[] {
	if (Array.isArray(value)) return [{ key, value: "", list: value.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))) }];
	if (value !== null && typeof value === "object") {
		return Object.entries(value as Record<string, unknown>).flatMap(([child, inner]) => toRows(`${key}.${child}`, inner));
	}
	return [{ key, value: value === null || value === undefined ? "" : String(value), list: null }];
}

/** The parser's message for frontmatter it could not read. */
function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Every part of one `.aide` file for the Details panel, so nothing in it is hidden: all its
 * frontmatter fields, then each `##` section of the body under its own heading, rendered as
 * markdown (code blocks such as a plan's Project Structure tree keep their layout, checklists show as
 * checkboxes). Text before the first `##` is its own block. Unreadable frontmatter is shown as text
 * with the parser's message.
 */
export default function buildFileBlocks({ text }: { text: string }): DrawerBlockModel[] {
	const normalized = text.replace(/\r\n?/g, "\n");
	const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
	const body = match === null ? normalized : normalized.slice(match[0].length);
	const blocks: DrawerBlockModel[] = [];

	if (match !== null) {
		try {
			const data = (parse(match[1] ?? "") ?? {}) as Record<string, unknown>;
			const rows = Object.entries(data).flatMap(([key, value]) => toRows(key, value));
			if (rows.length > 0) blocks.push({ heading: "Frontmatter", icon: "doc", badge: null, type: "fm", rows });
		} catch (error) {
			blocks.push({ heading: "Frontmatter (could not be read)", icon: "error", badge: null, type: "pre", text: `${messageOf(error)}\n\n${match[1]}` });
		}
	}

	for (const part of body.split(/^(?=## )/m)) {
		const heading = /^## (.*)$/m.exec(part);
		const markdown = heading === null ? part : part.slice(heading.index + heading[0].length);
		if (heading === null && markdown.trim() === "") continue;
		blocks.push({
			heading: heading === null ? "Body" : `## ${(heading[1] ?? "").trim()}`,
			icon: "list",
			badge: null,
			type: "md",
			markdown: markdown.trim() === "" ? "(empty)" : markdown,
		});
	}
	return blocks;
}
