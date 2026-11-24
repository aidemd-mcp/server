import { unlink } from "node:fs/promises";
import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { DeleteOutcome } from "@/service/observer/event/types/index.js";

/**
 * The part of a delete both addressing forms share, once the session's file
 * path is known: read the session the way `read` sees it, refuse an unreadable
 * or live one, and unlink exactly that one file. Every refusal is returned as
 * a value; a failed unlink other than a vanished file throws.
 */
export default async function removeSessionLog({
	path,
	sessionId,
}: {
	path: string;
	sessionId: string;
}): Promise<DeleteOutcome> {
	// 1. Read the session the way `read` sees it; no file means nothing to delete.
	const log = await readSessionLog({ path, sessionId });
	if (!log) return { outcome: "not-found" };

	// 2. Refuse a log that cannot be read: an unreadable file yields no events, which would judge the
	//    session not live by default, and deleting on that guess could remove a live session's log.
	if (log.unreadable) return { outcome: "unreadable" };

	// 3. Never delete a live session.
	if (log.live) return { outcome: "live" };

	// 4. Remove exactly this one file; a file that vanished since the read is not-found.
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { outcome: "not-found" };
		throw error;
	}

	return { outcome: "deleted" };
}
