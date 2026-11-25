import readPresence from "@/service/observer/event/shared/readPresence/index.js";

const WAIT_LIMIT_MS = 1000;
const POLL_MS = 100;

/**
 * Gives the caller's own hook presence time to link to its observer session before the HALT
 * check judges the project (brief commitment #91). Polls the project's presence every 100 ms for
 * at most 1 000 ms and returns as soon as a presence links to `sessionId` or no open presence is
 * left unlinked (an ended one never counts, it cannot be the caller). Running out of time is not
 * an error: the HALT check then runs on whatever is on disk. Never throws; an unreadable
 * presence folder counts as none.
 */
export default async function awaitOwnLink({
	projectKey,
	sessionId,
}: {
	projectKey: string;
	sessionId: string;
}): Promise<void> {
	const deadline = Date.now() + WAIT_LIMIT_MS;
	for (;;) {
		const presences = await readPresence({ projectKey }).catch(() => []);
		const linked = presences.some((presence) => presence.sessionId === sessionId);
		const unlinkedOpen = presences.some((presence) => presence.sessionId === undefined && presence.state !== "ended");
		if (linked || !unlinkedOpen) return;
		if (Date.now() >= deadline) return;
		await new Promise<void>((resolveWait) => setTimeout(resolveWait, POLL_MS));
	}
}
