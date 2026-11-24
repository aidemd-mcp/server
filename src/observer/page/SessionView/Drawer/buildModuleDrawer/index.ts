import type { DrawerBlockModel, DrawerContext, DrawerModel, ModuleFileKind, ModuleFiles } from "@/observer/page/types/index.js";
import findModuleRow from "@/observer/page/SessionView/Drawer/findModuleRow/index.js";
import buildBriefBlock from "./buildBriefBlock/index.js";
import buildPlanBlock from "./buildPlanBlock/index.js";
import buildSpecBlocks from "./buildSpecBlocks/index.js";
import buildTodoBlocks from "./buildTodoBlocks/index.js";
import describeModule from "./describeModule/index.js";

/** The module files in the order their blocks follow one another when none was opened first. */
const FILE_ORDER: ModuleFileKind[] = ["spec", "plan", "todo", "brief"];

/**
 * A module's drawer: its spec frontmatter and body, its plan checklist, its todo issues and retro,
 * from the file texts the page fetched (a file the module lists none of, or that was not fetched, adds
 * no block). `firstKind` is the file the user opened: its blocks lead, and a todo makes the kind
 * word `Module · todo`. The title is the module (the tree's label for the root); the meta line says
 * what the observer reported about it.
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
	const plan = files.plan === null ? null : buildPlanBlock({ text: files.plan, plan: row?.plan ?? null });
	const blocksOf: Record<ModuleFileKind, DrawerBlockModel[]> = {
		spec: files.spec === null ? [] : buildSpecBlocks({ text: files.spec }),
		plan: plan === null ? [] : [plan],
		todo: files.todo === null ? [] : buildTodoBlocks({ text: files.todo }),
		brief: files.brief === null ? [] : [buildBriefBlock({ text: files.brief })],
	};
	const order = firstKind === null ? FILE_ORDER : [firstKind, ...FILE_ORDER.filter((kind) => kind !== firstKind)];
	return {
		kind: firstKind === "todo" ? "Module · todo" : "Module",
		title: row?.label ?? folder,
		titleMono: true,
		meta: describeModule({ folder, row, context }),
		blocks: order.flatMap((kind) => blocksOf[kind]),
	};
}
