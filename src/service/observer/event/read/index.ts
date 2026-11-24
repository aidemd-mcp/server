import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import listProjectFolders from "@/util/runtimePaths/listProjectFolders/index.js";
import readProject from "@/service/observer/event/read/readProject/index.js";
import type { ProjectLog } from "@/service/observer/event/types/index.js";

/**
 * Lists every project that has recorded sessions, each with its sessions oldest
 * first and the root its newest session reported (null when none did), in key
 * order. With `{ projectKey }` it lists just that project, or nothing when the
 * key is not a valid key or the project has no sessions; an unknown key never
 * throws. Read never writes and never creates the app-data root.
 */
export default async function read({ projectKey }: { projectKey?: string } = {}): Promise<ProjectLog[]> {
	if (projectKey !== undefined && !isProjectKey(projectKey)) return [];

	const folders = await listProjectFolders();
	const wanted = projectKey === undefined ? folders : folders.filter((folder) => folder.projectKey === projectKey);

	const projects = await Promise.all(wanted.map(readProject));
	return projects.filter((project): project is ProjectLog => project !== null);
}
