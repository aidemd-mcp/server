import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { ProjectFolder } from "../types/index.js";
import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import isProjectKey from "../isProjectKey/index.js";
import { EVENTS_FOLDER } from "../shared/runtimeNames/index.js";

/**
 * List every project folder under the app-data root, sorted by key. Reads only:
 * never creates the root or anything in it. A missing root answers `[]`; any
 * other read error propagates. Files at the root (such as `observer.json`) and
 * folders whose name is not a project key are skipped.
 */
export default async function listProjectFolders(): Promise<ProjectFolder[]> {
	const pathModule = pickPathModule();
	const root = resolveAppDataRoot();

	const entries: Dirent[] = await readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return [];
		throw error;
	});

	return entries
		.filter((entry) => entry.isDirectory() && isProjectKey(entry.name))
		.map((entry) => ({
			projectKey: entry.name,
			eventsFolder: pathModule.join(root, entry.name, EVENTS_FOLDER),
		}))
		.sort((a, b) => (a.projectKey < b.projectKey ? -1 : a.projectKey > b.projectKey ? 1 : 0));
}
