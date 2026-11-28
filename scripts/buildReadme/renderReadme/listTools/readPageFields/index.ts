import { parse } from "yaml";
import type { ToolEntry } from "../index.js";

/**
 * Reads a tool reference page's `name` and `description` from its frontmatter.
 *
 * The aidemd.dev link is built from `name` while the site builds its page from
 * the file, so a `name` that differs from the file stem would link to a page
 * that does not exist; that and every other malformed field throws with the
 * `hostPath` named. The description is trimmed of outer whitespace only (a YAML
 * block scalar adds a trailing newline) and is otherwise word for word.
 */
export default function readPageFields({ hostPath, page }: { hostPath: string; page: string }): ToolEntry {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(page);
	if (!match) throw new Error(`${hostPath}: no frontmatter block found`);

	const fields: unknown = parse(match[1]);
	const { name, description } = (typeof fields === "object" && fields !== null ? fields : {}) as Record<string, unknown>;

	if (typeof name !== "string" || name.trim() === "") {
		throw new Error(`${hostPath}: frontmatter "name" is missing or not a non-empty string`);
	}
	if (typeof description !== "string" || description.trim() === "") {
		throw new Error(`${hostPath}: frontmatter "description" is missing or not a non-empty string`);
	}

	const stem = hostPath.split("/").pop()!.replace(/\.md$/, "");
	if (name !== stem) {
		throw new Error(`${hostPath}: frontmatter name "${name}" does not match the file stem "${stem}"`);
	}

	const trimmed = description.trim();
	if (/[\r\n]/.test(trimmed)) {
		throw new Error(`${hostPath}: frontmatter "description" must be a single line`);
	}

	return { name, description: trimmed };
}
