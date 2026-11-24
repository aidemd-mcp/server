import type { ObserverEvent } from "@/types/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";

/** The ISO start of a session: the sessions list's `startedAt`, else the time of its first held event, else null. */
export default function findSessionStart({
	sessionId,
	sessions,
	events,
}: {
	sessionId: string;
	sessions: SessionRowModel[];
	events: ObserverEvent[];
}): string | null {
	const listed = sessions.find((session) => session.sessionId === sessionId);
	if (listed !== undefined) return listed.startedAt;
	let first: ObserverEvent | null = null;
	for (const event of events) if (event.sessionId === sessionId && (first === null || event.seq < first.seq)) first = event;
	return first?.ts ?? null;
}
