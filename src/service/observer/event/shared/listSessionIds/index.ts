import { readdir } from "node:fs/promises";
import { dirname } from "node:path";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";
import { LOG_EXTENSION } from "@/util/runtimePaths/shared/runtimeNames/index.js";

/** The log stems in one folder; a missing folder is empty, any other read error propagates. */
async function listStems(folder: string): Promise<string[]> {
	let names: string[];
	try {
		names = await readdir(folder);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}

	return names.filter((name) => name.endsWith(LOG_EXTENSION)).map((name) => name.slice(0, -LOG_EXTENSION.length));
}

/**
 * Lists the id of every session that still has a log in a project: the events
 * folder and the archive folder. Valid session ids only, unique, ascending. A
 * missing folder counts as empty; another read error throws. Never writes and
 * never creates a folder.
 */
export default async function listSessionIds({ projectKey }: { projectKey: string }): Promise<string[]> {
	const folders = [
		dirname(resolveSessionLog({ projectKey, sessionId: "probe" })),
		dirname(resolveArchivedLog({ projectKey, sessionId: "probe" })),
	];
	const stems = (await Promise.all(folders.map(listStems))).flat();

	return [...new Set(stems.filter(isSessionId))].sort();
}
