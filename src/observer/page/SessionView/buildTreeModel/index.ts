import type { ModuleRow, TreeData, TreeEntry } from "@/observer/page/types/index.js";
import hasOpenWork from "@/observer/page/SessionView/hasOpenWork/index.js";
import pickInitialCollapsed from "@/observer/page/SessionView/pickInitialCollapsed/index.js";
import buildChips from "./buildChips/index.js";
import flattenModules from "./flattenModules/index.js";
import pickAlignment from "./pickAlignment/index.js";
import pickDepth from "./pickDepth/index.js";

/**
 * The intent tree's data from the modules the observer reported: every node in tree order with its
 * alignment, chips, indent and descendant count, the totals the count line states, and the folders
 * that start collapsed (`pickInitialCollapsed`, which keeps the current module's ancestors open).
 * `current` is the working module's folder and `currentLabel` what its node says about it.
 */
export default function buildTreeModel({
	modules,
	current,
	currentLabel,
}: {
	modules: ModuleRow[];
	current: string | null;
	currentLabel: string | null;
}): TreeData {
	const entries: TreeEntry[] = flattenModules({ modules }).map(({ module, ancestors, descendants, hasChildren }) => {
		const alignment = pickAlignment({ module });
		return {
			folder: module.folder,
			path: module.label,
			depth: pickDepth({ folder: module.folder }),
			description: module.description,
			alignment,
			chips: buildChips({ module }),
			current: module.folder === current ? currentLabel : null,
			misaligned: alignment === "misaligned",
			hasChildren,
			ancestors,
			descendants,
			openWork: hasOpenWork({ module }),
		};
	});

	return {
		kind: "tree",
		entries,
		counts: {
			modules: entries.length,
			misaligned: entries.filter((entry) => entry.misaligned).length,
			openWork: entries.filter((entry) => entry.openWork).length,
		},
		initialCollapsed: [...pickInitialCollapsed({ modules, current })],
	};
}
