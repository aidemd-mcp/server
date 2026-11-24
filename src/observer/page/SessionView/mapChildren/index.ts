import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { ModuleRow } from "@/observer/page/types/index.js";

/**
 * Each module's children keyed by parent folder, in the order `modules` lists them. A module's parent
 * is the longest other module folder that prefixes `folder + "/"`, else the root; the root has none.
 * A module with no parent (no root row in the list) is keyed under `null`.
 */
export default function mapChildren({ modules }: { modules: ModuleRow[] }): Map<string | null, ModuleRow[]> {
	const folders = modules.map((module) => module.folder).filter((folder) => folder !== ROOT_FOLDER);
	const hasRoot = modules.some((module) => module.folder === ROOT_FOLDER);
	const children = new Map<string | null, ModuleRow[]>();

	for (const module of modules) {
		if (module.folder === ROOT_FOLDER) continue;
		let parent: string | null = hasRoot ? ROOT_FOLDER : null;
		let best = 0;
		for (const folder of folders) {
			if (folder !== module.folder && module.folder.startsWith(folder + "/") && folder.length > best) {
				parent = folder;
				best = folder.length;
			}
		}
		const list = children.get(parent);
		if (list) list.push(module);
		else children.set(parent, [module]);
	}
	return children;
}
