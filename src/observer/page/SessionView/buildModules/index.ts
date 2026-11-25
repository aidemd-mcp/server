import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { ModuleNode } from "@/types/index.js";
import type { ModuleRow } from "@/observer/page/types/index.js";

/** What the tree shows for the root module. */
const ROOT_LABEL = "root";

/** One row for a node holding an intent spec or a brief, plan, todo or research file. */
function buildRow({ node }: { node: ModuleNode }): ModuleRow | null {
	const row: ModuleRow = {
		folder: node.folder,
		label: node.folder === ROOT_FOLDER ? ROOT_LABEL : node.folder,
		description: null,
		alignment: null,
		intentFile: null,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
	};
	let holdsSpecOrWork = false;

	for (const entry of node.files) {
		if (entry.kind === "session" || entry.kind === "other") continue;
		holdsSpecOrWork = true;
		if (entry.read.state === "malformed") {
			row.malformed.push(entry.file);
		}

		if (entry.kind === "intent") {
			if (row.intentFile !== null) continue;
			row.intentFile = entry.file;
			if (entry.read.state === "present") {
				row.description = entry.read.description;
				row.alignment = entry.read.alignment === "unset" ? null : entry.read.alignment;
			}
		} else if (entry.kind === "research") {
			if (row.research === null && entry.read.state === "present") row.research = entry.file;
		} else if (entry.read.state === "present") {
			if (entry.kind === "brief" && row.brief === null) {
				row.brief = entry.file;
			} else if (entry.kind === "plan" && row.plan === null) {
				row.plan = {
					file: entry.file,
					status: entry.read.status,
					done: entry.read.steps.done,
					total: entry.read.steps.total,
				};
			} else if (entry.kind === "todo" && row.todo === null) {
				row.todo = { file: entry.file, open: entry.read.progress.open, total: entry.read.progress.total };
			}
		}
	}

	return holdsSpecOrWork ? row : null;
}

/**
 * One `ModuleRow` per tree node that holds an intent spec or any brief, plan, todo or research file,
 * the root first and the rest sorted by folder. Every value is what the observer reported: an `unset`
 * alignment becomes null (no chip), and a file the observer could not read is listed in `malformed`
 * and leaves its chip out.
 */
export default function buildModules({ tree }: { tree: ModuleNode[] }): ModuleRow[] {
	const rows: ModuleRow[] = [];
	for (const node of tree) {
		const row = buildRow({ node });
		if (row !== null) rows.push(row);
	}
	return rows.sort((a, b) => {
		if (a.folder === ROOT_FOLDER) return -1;
		if (b.folder === ROOT_FOLDER) return 1;
		return a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0;
	});
}
