import type { DrawerBlockModel, DrawerContext, DrawerModel, DrawerSection, ModuleFileKind, ModuleFiles, TreeAlignment } from "@/observer/page/types/index.js";
import findModuleRow from "@/observer/page/SessionView/Drawer/findModuleRow/index.js";
import baseName from "@/util/baseName/index.js";
import describeModule from "./describeModule/index.js";
import buildFileBlocks from "../buildFileBlocks/index.js";

/** The module files in the order their accordion rows follow one another. */
const FILE_ORDER: ModuleFileKind[] = ["spec", "session", "brief", "plan", "todo", "research"];

/**
 * A module's drawer: one accordion row per AIDE file the module has, labelled by its file name
 * (`.aide`, `brief.aide`, `plan.aide`, `todo.aide`, `research.aide`) with its status, holding the
 * whole file: every frontmatter field and every `##` section (see `buildFileBlocks`), so nothing in
 * a spec is hidden. `firstKind` is the file the user opened (a
 * chip, a waiting file); it is the row open first, else the spec. The title is the module; the meta
 * line says what the observer reported about it.
 */
export default function buildModuleDrawer({
	folder,
	firstKind,
	files,
	context,
}: {
	folder: string;
	firstKind: ModuleFileKind | null;
	files: ModuleFiles;
	context: DrawerContext;
}): DrawerModel {
	const row = findModuleRow({ folder, context });
	const blocksOf: Record<ModuleFileKind, DrawerBlockModel[]> = {
		spec: files.spec === null ? [] : buildFileBlocks({ text: files.spec }),
		brief: files.brief === null ? [] : buildFileBlocks({ text: files.brief }),
		plan: files.plan === null ? [] : buildFileBlocks({ text: files.plan }),
		todo: files.todo === null ? [] : buildFileBlocks({ text: files.todo }),
		research: files.research === null ? [] : buildFileBlocks({ text: files.research }),
		session: files.session === null ? [] : buildFileBlocks({ text: files.session }),
	};
	const pathOf: Record<ModuleFileKind, string | null> = {
		spec: row?.intentFile ?? null,
		brief: row?.brief ?? null,
		plan: row?.plan?.file ?? null,
		todo: row?.todo?.file ?? null,
		research: row?.research ?? null,
		session: folder === "." ? ".aide/session.aide" : null,
	};
	const statusOf: Record<ModuleFileKind, string | null> = {
		spec: row?.alignment ?? null,
		brief: null,
		plan: row?.plan ? `${row.plan.status === "unset" ? "no status" : row.plan.status} · ${row.plan.done}/${row.plan.total}` : null,
		todo: row?.todo ? `${row.todo.open} open of ${row.todo.total}` : null,
		research: null,
		session: null,
	};
	const list: DrawerSection[] = FILE_ORDER.filter((kind) => blocksOf[kind].length > 0).map((kind) => {
		const path = pathOf[kind] ?? "";
		return { kind, path, label: path === "" ? kind : baseName(path), status: statusOf[kind], blocks: blocksOf[kind] };
	});
	const open = firstKind !== null && list.some((section) => section.kind === firstKind) ? firstKind : (list[0]?.kind ?? "spec");
	return {
		kind: "Module",
		title: row?.label ?? folder,
		titleMono: true,
		meta: describeModule({ folder, row, context }),
		blocks: list.flatMap((section) => section.blocks),
		alignment: (row?.alignment as TreeAlignment | null | undefined) ?? null,
		sections: { open, list },
	};
}
