import { readFile } from "node:fs/promises";
import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import parseLines from "@/service/observer/event/shared/readSessionLog/parseLines/index.js";
import type { SessionLog } from "@/service/observer/event/types/index.js";

/**
 * Reads one session's log file and judges whether the session is live.
 * Resolves null when the file does not exist (including when it vanishes
 * mid-read), and an `unreadable` log when it exists but cannot be read.
 * Shared because `read` and `delete` must both see a session the same way.
 * It never writes.
 */
export default async function readSessionLog({
	path,
	sessionId,
}: {
	path: string;
	sessionId: string;
}): Promise<SessionLog | null> {
	// 1. Read the file as UTF-8.
	let content: string;
	try {
		content = await readFile(path, "utf-8");
	} catch (error) {
		// 2. A missing file is no session (e.g. deleted mid-read).
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		// 3. Any other read error: the session exists but cannot be shown.
		return { sessionId, started: null, events: [], skippedLines: 0, live: false, unreadable: true };
	}

	// 4. Keep the valid events of this session, in seq order.
	const { events, skippedLines } = parseLines({ content, sessionId });

	// 5. The session's reported start, exactly as recorded.
	const started = events.find((event) => event.kind === "session_started") ?? null;

	// 6. Liveness by the one shared rule.
	const live = judgeLiveness({ events, now: Date.now() });

	return { sessionId, started, events, skippedLines, live, unreadable: false };
}
