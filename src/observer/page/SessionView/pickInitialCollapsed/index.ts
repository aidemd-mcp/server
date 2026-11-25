import type { ModuleRow } from "@/observer/page/types/index.js";
import mapChildren from "@/observer/page/SessionView/mapChildren/index.js";

/** The folders the intent tree starts collapsed: every folder with children, the root included, so the tree opens fully closed. */
export default function pickInitialCollapsed({ modules }: { modules: ModuleRow[]; current: string | null }): Set<string> {
	const children = mapChildren({ modules });
	return new Set(modules.filter((module) => children.has(module.folder)).map((module) => module.folder));
}
