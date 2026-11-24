import describeError from "@/util/describeError/index.js";
import scan from "@/util/scan/index.js";
import type { ModuleNode, TreeFileEntry, TreeFileKind } from "../types/index.js";
import classifyTreeFile from "./classifyTreeFile/index.js";
import readTreeFile from "./readTreeFile/index.js";
import findParentFolder from "./findParentFolder/index.js";
import toNodeFolder from "../shared/toNodeFolder/index.js";

/** The order files appear within a node. */
const KIND_ORDER: readonly TreeFileKind[] = ["intent", "brief", "research", "plan", "todo", "session", "other"];

/**
 * Builds the tree of every AIDE file under the project, grouped by node folder.
 * No file is filtered out; a file that cannot be read becomes a malformed entry
 * without touching its neighbours. Read-only.
 */
export default async function buildModuleNodes({ projectRoot }: { projectRoot: string }): Promise<ModuleNode[]> {
	// Scan deeply: every AIDE file, with description, alignment and work status.
	const { files } = await scan(projectRoot);

	// Classify and read each file in its own try so one bad file never breaks another.
	const entries = await Promise.all(
		files.map(async (file): Promise<TreeFileEntry> => {
			const kind = classifyTreeFile(file.relativePath);
			try {
				return await readTreeFile({ file, kind });
			} catch (error) {
				return { file: file.relativePath, folder: toNodeFolder(file.relativePath), kind, read: { state: "malformed", error: describeError({ error }) } };
			}
		}),
	);

	// Group entries by node folder.
	const byFolder = new Map<string, TreeFileEntry[]>();
	for (const entry of entries) {
		const group = byFolder.get(entry.folder) ?? [];
		group.push(entry);
		byFolder.set(entry.folder, group);
	}

	// Order files within a node: by kind, then by path.
	const folders = [...byFolder.keys()];
	const nodes = folders.map((folder): ModuleNode => ({
		folder,
		parent: findParentFolder({ folder, folders }),
		files: byFolder.get(folder)!.sort(
			(a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
		),
	}));

	// Order nodes: the root first, then by folder.
	return nodes.sort((a, b) => {
		if (a.folder === ".") return -1;
		if (b.folder === ".") return 1;
		return a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0;
	});
}
