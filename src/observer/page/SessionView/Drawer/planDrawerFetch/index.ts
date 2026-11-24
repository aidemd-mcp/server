import type { DrawerContext, DrawerFetchPlan, DrawerFileRole, DrawerItem, ModuleFileKind } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import classifyFile from "@/observer/page/SessionView/Drawer/classifyFile/index.js";
import findModuleRow from "@/observer/page/SessionView/Drawer/findModuleRow/index.js";

/** What a module's drawer reads: the spec, plan and todo its row lists, and the opened file under its own role (it wins over the row's). */
function planModule({ folder, opened, context }: { folder: string; opened: { kind: ModuleFileKind; path: string } | null; context: DrawerContext }): DrawerFetchPlan {
	const row = findModuleRow({ folder, context });
	const listed: [DrawerFileRole, string | null | undefined][] = [
		["spec", row?.intentFile],
		["plan", row?.plan?.file],
		["todo", row?.todo?.file],
		["brief", opened?.kind === "brief" ? row?.brief : null],
	];
	const files = new Map<DrawerFileRole, string>();
	for (const [role, path] of listed) if (path) files.set(role, path);
	if (opened !== null) files.set(opened.kind, opened.path);
	return files.size === 0 ? { type: "none" } : { type: "files", files: [...files].map(([role, path]) => ({ role, path })) };
}

/**
 * What an item needs fetched before its drawer can be built: a module its spec, plan and todo files
 * (those its tree row lists), an AIDE file the same for its module with that file always included,
 * any other file itself, a task its note, a QA verdict its module's todo, any other event nothing.
 */
export default function planDrawerFetch({ item, context }: { item: DrawerItem; context: DrawerContext }): DrawerFetchPlan {
	switch (item.kind) {
		case "task":
			return { type: "task", slug: item.slug };
		case "module":
			return planModule({ folder: item.folder, opened: null, context });
		case "file": {
			const classified = classifyFile(item.path);
			if (classified === null) return { type: "files", files: [{ role: "file", path: item.path }] };
			return planModule({ folder: classified.folder, opened: { kind: classified.kind, path: item.path }, context });
		}
		case "event": {
			const event = context.events.find((candidate) => candidate.sessionId === item.sessionId && candidate.seq === item.seq);
			if (event?.kind !== "qa_verdict") return { type: "none" };
			const module = normalizeModule({ projectRoot: context.status?.projectRoot ?? "", module: event.module });
			const path = findModuleRow({ folder: module, context })?.todo?.file;
			return path ? { type: "files", files: [{ role: "todo", path }] } : { type: "none" };
		}
	}
}
