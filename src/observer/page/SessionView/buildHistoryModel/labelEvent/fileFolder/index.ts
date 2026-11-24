import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";

/**
 * The module folder a project-relative file belongs to: its folder, the root folder for a file at the root or
 * directly inside `.aide/` (where the root spec, plan and todo live).
 */
export default function fileFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	if (slash === -1) return ROOT_FOLDER;
	const folder = path.slice(0, slash);
	return folder === ".aide" ? ROOT_FOLDER : folder;
}
