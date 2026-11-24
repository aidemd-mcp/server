import baseName from "@/util/baseName/index.js";
import type { ModuleFileKind } from "@/observer/page/types/index.js";
import fileFolder from "@/observer/page/SessionView/buildHistoryModel/labelEvent/fileFolder/index.js";

/** The module file each AIDE file name stands for: the intent spec is `.aide` in a module and `intent.aide` at the root. */
const KIND_BY_NAME = new Map<string, ModuleFileKind>([
	[".aide", "spec"],
	["intent.aide", "spec"],
	["plan.aide", "plan"],
	["todo.aide", "todo"],
	["brief.aide", "brief"],
]);

/**
 * Which module file a project-relative path is, and the module folder it belongs to (`.` for the
 * root, whose files live in `.aide/`); null for any other file, which the drawer shows as plain text.
 */
export default function classifyFile(path: string): { folder: string; kind: ModuleFileKind } | null {
	const kind = KIND_BY_NAME.get(baseName(path));
	return kind === undefined ? null : { folder: fileFolder(path), kind };
}
