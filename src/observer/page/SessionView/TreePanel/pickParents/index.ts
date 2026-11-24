import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { TreeData } from "@/observer/page/types/index.js";

/** Every folder with modules below it except the root: the folders `Collapse all` folds. */
export default function pickParents({ tree }: { tree: TreeData }): string[] {
	return tree.entries.filter((entry) => entry.hasChildren && entry.folder !== ROOT_FOLDER).map((entry) => entry.folder);
}
