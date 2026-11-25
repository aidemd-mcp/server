import { stat } from "node:fs/promises";
import create from "@/util/runtimePaths/create/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import type { EndSessionOutcome } from "@/service/observer/event/types/index.js";

/** True when a file exists at `path`; any stat failure counts as absent. */
async function exists(path: string): Promise<boolean> {
	return stat(path).then(
		() => true,
		() => false,
	);
}

/** The mark's subject for `id`, or null when nothing in this project carries it. */
async function findTarget({
	projectKey,
	id,
	presence,
}: {
	projectKey: string;
	id: string;
	presence: { sessionId?: string } | undefined;
}): Promise<{ sessionId: string } | { claudeSessionId: string } | null> {
	if (presence) return presence.sessionId ? { sessionId: presence.sessionId } : { claudeSessionId: id };

	const known =
		(await exists(resolveSessionLog({ projectKey, sessionId: id }))) ||
		(await exists(resolveArchivedLog({ projectKey, sessionId: id })));
	return known ? { sessionId: id } : null;
}

/**
 * Ends another session of the caller's own project by writing its ended mark with `endedBy:
 * "user"` (brief commitments #74, #93); deletes nothing, ever. `id` names an observer session of
 * this project (its log is in the events or the archive folder) or the Claude session id of one of
 * its hook presences: a presence linked to an observer session ends that session, an unlinked one
 * gets a mark keyed by its Claude id. The caller's own session, and every Claude session linked to
 * it, is refused. A bad id, an own session and an unknown id come back as values, never as
 * thrown errors; a failed filesystem read or write propagates.
 */
export default async function endSession({
	projectRoot,
	id,
	bySessionId,
}: {
	projectRoot: string;
	id: string;
	bySessionId: string;
}): Promise<EndSessionOutcome> {
	if (!isSessionId(id)) return { outcome: "invalid-id", detail: `Invalid session id "${id}"` };
	if (id === bySessionId) return { outcome: "own-session", id };

	// The project's key and folders, the same ones the recorder and the hook use.
	const { projectKey } = await create({ projectRoot });

	// A Claude session id of this project: the presence says whose session it is.
	const presence = (await readPresence({ projectKey })).find((record) => record.claudeSessionId === id);
	if (presence?.sessionId === bySessionId) return { outcome: "own-session", id };

	const target = await findTarget({ projectKey, id, presence });
	if (!target) return { outcome: "unknown", id };

	const written = await writeEndedMark({
		projectKey,
		mark: { v: 1, ...target, endedAt: new Date().toISOString(), endedBy: "user", bySessionId },
	});
	return { outcome: written === "written" ? "ended" : "already-ended", id };
}
