import { isAbsolute } from "node:path";
import type { BrainKanbanField } from "@/types/index.js";

/**
 * Judges the shape of the brain config's optional `kanban` frontmatter field
 * (observer brief commitment 112). Meaning belongs to the observer: whether the
 * folder exists and which board it is are never checked here.
 *
 * Checks run in order and the first fault returns:
 * 1. `value` is not a mapping -> malformed `kanban`;
 * 2. `source` missing or not a string -> malformed `kanban.source`;
 * 3. `source` is not `folder` -> malformed `kanban.source`;
 * 4. `path` key absent -> malformed `kanban.path`;
 * 5. `path` null -> declared and unwired (`path: null`);
 * 6. `path` not a string -> malformed `kanban.path`;
 * 7. `path` not absolute on this OS (the empty string included) -> malformed `kanban.path`;
 * 8. otherwise declared, the path kept verbatim.
 *
 * Unknown keys inside the mapping are ignored. Pure; never throws.
 */
export default function parseKanbanField({ value }: { value: unknown }): BrainKanbanField {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { state: "malformed", field: "kanban", fault: "must be a mapping with `source` and `path`" };
	}

	const field = value as Record<string, unknown>;
	const source = field["source"];
	if (typeof source !== "string") {
		return { state: "malformed", field: "kanban.source", fault: "is required and must be `folder`" };
	}
	if (source !== "folder") {
		return {
			state: "malformed",
			field: "kanban.source",
			fault: `\`${source}\` is not a supported source; the only supported source is \`folder\``,
		};
	}

	if (!Object.prototype.hasOwnProperty.call(field, "path")) {
		return {
			state: "malformed",
			field: "kanban.path",
			fault: "is required: the absolute path of the brain's kanban folder, left empty while unwired",
		};
	}
	const path = field["path"];
	if (path === null) return { state: "declared", source: "folder", path: null };
	if (typeof path !== "string") {
		return { state: "malformed", field: "kanban.path", fault: "must be an absolute path or left empty" };
	}
	if (!isAbsolute(path)) {
		return {
			state: "malformed",
			field: "kanban.path",
			fault: `must be an absolute path, got ${JSON.stringify(path)}`,
		};
	}
	return { state: "declared", source: "folder", path };
}
