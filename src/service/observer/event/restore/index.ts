import { access, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { RestoreOutcome } from "@/service/observer/event/types/index.js";

/**
 * Restores one archived session: moves its event log from the project's `archive` folder back into
 * its `events` folder and returns the session as `read` sees it, so the caller can hold it again.
 * Refuses when a log with that id already sits in the events folder (nothing is overwritten). An
 * unsafe key or id, a missing archived session and a name clash are returned as values; a failed
 * move other than a vanished file throws.
 */
export default async function restoreSession(input: { projectKey: string; sessionId: string }): Promise<RestoreOutcome> {
	// 1. Turn key and id into both paths; an unsafe key or id is rejected, never resolved.
	let from: string;
	let to: string;
	try {
		from = resolveArchivedLog(input);
		to = resolveSessionLog(input);
	} catch (error) {
		return { outcome: "invalid-id", detail: (error as Error).message };
	}

	// 2. No archived file means nothing to restore; one in the events folder already means nothing is overwritten.
	const exists = (file: string) =>
		access(file).then(
			() => true,
			() => false,
		);
	if (!(await exists(from))) return { outcome: "not-found" };
	if (await exists(to)) return { outcome: "exists" };

	// 3. Move exactly this one file back; no archived file means nothing to restore.
	await mkdir(dirname(to), { recursive: true });
	try {
		await rename(from, to);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { outcome: "not-found" };
		throw error;
	}

	// 4. Read it back the way `read` sees it; a file that vanished again is not-found.
	const session = await readSessionLog({ path: to, sessionId: input.sessionId });
	return session ? { outcome: "restored", session } : { outcome: "not-found" };
}
