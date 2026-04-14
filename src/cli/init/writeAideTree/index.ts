import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";

export interface WriteAideTreeResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Write the `.aide/bin/aide-tree.mjs` launcher script to the host project.
 *
 * Target path is `<projectRoot>/.aide/bin/aide-tree.mjs`. Returns `exists`
 * when the file is already present on disk. Otherwise creates the full parent
 * directory tree, reads the canonical content via `readCanonicalDoc`, writes
 * the file, and returns `created`.
 */
export default async function writeAideTree(
	projectRoot: string,
): Promise<WriteAideTreeResult> {
	const launcherPath = join(projectRoot, ".aide", "bin", "aide-tree.mjs");

	try {
		await access(launcherPath);
		return { status: "exists", message: "aide-tree launcher already present" };
	} catch {
		// ENOENT — file does not exist, proceed to create
	}

	await mkdir(dirname(launcherPath), { recursive: true });

	const content = readCanonicalDoc("bin/aide-tree");
	await writeFile(launcherPath, content, "utf-8");

	return { status: "created", message: "aide-tree launcher" };
}
