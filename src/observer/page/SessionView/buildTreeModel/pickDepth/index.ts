import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { TreeEntry } from "@/observer/page/types/index.js";

/** The deepest indent step the stylesheet draws (`.av-node.d4`). */
const MAX_DEPTH = 4;

/** A module's indent step: the root is 0, every other module its folder's segment count, capped at 4. */
export default function pickDepth({ folder }: { folder: string }): TreeEntry["depth"] {
	if (folder === ROOT_FOLDER) return 0;
	return Math.min(folder.split("/").length, MAX_DEPTH) as TreeEntry["depth"];
}
