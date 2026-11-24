import type { DrawerContext, ModuleRow } from "@/observer/page/types/index.js";
import buildModules from "@/observer/page/SessionView/buildModules/index.js";

/** The tree's row for a module folder, or null when the project has no status or the tree lists no AIDE file there. */
export default function findModuleRow({ folder, context }: { folder: string; context: DrawerContext }): ModuleRow | null {
	if (context.status === null) return null;
	return buildModules({ tree: context.status.tree }).find((row) => row.folder === folder) ?? null;
}
