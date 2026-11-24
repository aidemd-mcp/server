import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { FlatModule, ModuleRow } from "@/observer/page/types/index.js";
import mapChildren from "@/observer/page/SessionView/mapChildren/index.js";

/**
 * Every module in depth-first tree order, the root first and each module's children after it in the
 * order `mapChildren` lists them. A module with no root above it starts its own branch. Each entry
 * carries its ancestor folders and its descendant count, so a collapse can hide it and say how many
 * it hid without walking the tree again.
 */
export default function flattenModules({ modules }: { modules: ModuleRow[] }): FlatModule[] {
	const children = mapChildren({ modules });
	const flat: FlatModule[] = [];

	const walk = ({ module, ancestors }: { module: ModuleRow; ancestors: string[] }): number => {
		const kids = children.get(module.folder) ?? [];
		const entry: FlatModule = { module, ancestors, descendants: 0, hasChildren: kids.length > 0 };
		flat.push(entry);
		for (const kid of kids) entry.descendants += 1 + walk({ module: kid, ancestors: [...ancestors, module.folder] });
		return entry.descendants;
	};

	const root = modules.find((module) => module.folder === ROOT_FOLDER);
	if (root) walk({ module: root, ancestors: [] });
	else for (const top of children.get(null) ?? []) walk({ module: top, ancestors: [] });
	return flat;
}
