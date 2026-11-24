import type { TreePanelModel } from "@/observer/page/types/index.js";

/** The folders the tree starts folded: the model's own collapsed set, or none for a project with no tree. */
export default function pickCollapsed({ tree }: { tree: TreePanelModel }): ReadonlySet<string> {
	return new Set(tree.kind === "tree" ? tree.initialCollapsed : []);
}
