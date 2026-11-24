import { useState } from "react";
import type { TreePanelModel, TreeView } from "@/observer/page/types/index.js";
import initTreeView from "./initTreeView/index.js";
import pickCollapsed from "./pickCollapsed/index.js";

/**
 * The intent tree tab's state, held above the tab panel so the filter, the two toggles and the
 * folded folders survive a trip to another tab (the handoff keeps them in the one viewer state).
 * Folding starts from the model's own collapsed set and is seeded again once the tree's modules
 * first arrive, so it follows the first real tree rather than the empty one drawn before the status
 * came; the filter and toggles are left as the user set them.
 */
export default function useTreeView({ tree }: { tree: TreePanelModel }): [TreeView, (view: TreeView) => void] {
	const arrived = tree.kind === "tree" && tree.entries.length > 0;
	const [state, setState] = useState(() => ({ arrived, view: initTreeView({ tree }) }));
	if (state.arrived === arrived) return [state.view, (view) => setState({ arrived, view })];

	// Adjusting state while rendering is React's way to reseed from a prop change without an extra paint.
	const view = { ...state.view, collapsed: pickCollapsed({ tree }) };
	setState({ arrived, view });
	return [view, (next) => setState({ arrived, view: next })];
}
