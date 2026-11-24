import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { ModuleRow } from "@/observer/page/types/index.js";
import mapChildren from "@/observer/page/SessionView/mapChildren/index.js";

/** At most this many modules are shown fully expanded. */
const EXPAND_LIMIT = 40;

/**
 * The folders the intent tree starts collapsed: none for 40 modules or fewer; above that, every
 * folder with children except the root and the ancestors of the current module, so the current
 * module stays visible.
 */
export default function pickInitialCollapsed({
	modules,
	current,
}: {
	modules: ModuleRow[];
	current: string | null;
}): Set<string> {
	const collapsed = new Set<string>();
	if (modules.length <= EXPAND_LIMIT) return collapsed;

	const children = mapChildren({ modules });
	for (const module of modules) {
		if (module.folder === ROOT_FOLDER) continue;
		if (!children.has(module.folder)) continue;
		if (current !== null && current.startsWith(module.folder + "/")) continue;
		collapsed.add(module.folder);
	}
	return collapsed;
}
