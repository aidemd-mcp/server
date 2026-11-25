import type { ObserverEvent, SessionLiveness } from "@/types/index.js";
import type { SessionSummary } from "../types/index.js";

/**
 * Folds every recorded event into one summary per session, newest first.
 * Each summary's liveness is the one the caller judged for that session
 * (`liveness[sessionId]`), passed through unchanged: status never re-judges it
 * from event age or a pid (brief commitment #76). Pure.
 */
export default function foldSessions({
	events,
	liveness,
}: {
	events: ObserverEvent[];
	liveness: Record<string, SessionLiveness>;
}): SessionSummary[] {
	// Step 1: group the events by session.
	const groups = new Map<string, ObserverEvent[]>();
	for (const event of events) {
		const group = groups.get(event.sessionId);
		if (group) group.push(event);
		else groups.set(event.sessionId, [event]);
	}

	// Step 2: fold each group, ordered by seq, into its summary.
	const summaries = [...groups.entries()].map(([sessionId, group]): SessionSummary => {
		const ordered = [...group].sort((a, b) => a.seq - b.seq);
		const first = ordered[0];
		const last = ordered[ordered.length - 1];

		return {
			sessionId,
			startedAt: first.ts,
			lastEventAt: last.ts,
			eventCount: ordered.length,
			pid: last.pid,
			liveness: liveness[sessionId],
			reported: readReported(ordered),
		};
	});

	// Step 3: newest start first; ties by sessionId descending.
	return summaries.sort((a, b) => {
		if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
		if (a.sessionId === b.sessionId) return 0;
		return a.sessionId < b.sessionId ? 1 : -1;
	});
}

/** The first `session_started` event's reported keys (only the ones it has), or null. */
function readReported(ordered: ObserverEvent[]): SessionSummary["reported"] {
	const started = ordered.find((event) => event.kind === "session_started");
	if (!started || started.kind !== "session_started") return null;

	const reported: NonNullable<SessionSummary["reported"]> = {};
	if (started.projectRoot !== undefined) reported.projectRoot = started.projectRoot;
	if (started.kanbanTag !== undefined) reported.kanbanTag = started.kanbanTag;
	if (started.brainPath !== undefined) reported.brainPath = started.brainPath;
	return reported;
}
