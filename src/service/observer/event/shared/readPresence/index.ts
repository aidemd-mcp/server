import { readdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import parseJson from "@/service/observer/event/shared/readObserverRecord/parseJson/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";
import { RECORD_EXTENSION } from "@/util/runtimePaths/shared/runtimeNames/index.js";
import { schema, type Presence } from "@/service/observer/event/shared/presenceRecord/index.js";

/**
 * Lists one project's hook presence records. A key that is not a project key
 * and a missing presence folder answer `[]`. A file is kept only when its stem
 * is a safe session id, it parses against the presence schema and its own
 * `claudeSessionId` equals the stem; an unreadable, malformed or mis-named
 * file is skipped. Never writes and never creates the folder.
 */
export default async function readPresence({ projectKey }: { projectKey: string }): Promise<Presence[]> {
	if (!isProjectKey(projectKey)) return [];

	// 1. The presence folder is the directory of any presence path; list it.
	const folder = dirname(resolvePresenceFile({ projectKey, claudeSessionId: "probe" }));
	let names: string[];
	try {
		names = await readdir(folder);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}

	// 2. Read every record file in parallel; one bad file never spoils the rest.
	const stems = names
		.filter((name) => name.endsWith(RECORD_EXTENSION))
		.map((name) => name.slice(0, -RECORD_EXTENSION.length))
		.filter(isSessionId);
	const records = await Promise.all(
		stems.map(async (stem): Promise<Presence | null> => {
			const content = await readFile(resolvePresenceFile({ projectKey, claudeSessionId: stem }), "utf-8").catch(
				() => null,
			);
			if (content === null) return null;
			const json = parseJson(content);
			if (json === undefined) return null;
			const parsed = schema.safeParse(json);
			return parsed.success && parsed.data.claudeSessionId === stem ? parsed.data : null;
		}),
	);

	return records.filter((record): record is Presence => record !== null);
}
