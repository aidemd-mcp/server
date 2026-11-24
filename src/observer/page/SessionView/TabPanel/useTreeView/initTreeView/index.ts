import type { TreePanelModel, TreeView } from "@/observer/page/types/index.js";
import pickCollapsed from "@/observer/page/SessionView/TabPanel/useTreeView/pickCollapsed/index.js";

/** A tree tab nobody has touched: no filter, both toggles off, the folders folded as the tree starts them. */
export default function initTreeView({ tree }: { tree: TreePanelModel }): TreeView {
	return { query: "", onlyOpen: false, onlyMisaligned: false, collapsed: pickCollapsed({ tree }) };
}
