import isProcessRunning from "@/util/isProcessRunning/index.js";
import SESSION_IDLE_LIMIT_MS from "@/util/sessionIdleLimit/index.js";
import type { ObserverEvent } from "@/types/index.js";
import type { Liveness, SessionSummary } from "../types/index.js";

/**
 * Folds every recorded event into one summary per session, newest first.
 * Liveness is `live` (last event under the shared `SESSION_IDLE_LIMIT_MS` old), `idle` (older but
 * the session's pid is still running) or `ended` (neither) — exactly the event
 * module's "not live" (brief commitments #18, #23), so a session shown live or
 * idle is one the delete control refuses. Pure apart from the pid probe.
 */
export default function foldSessions({ events, now }: { events: ObserverEvent[]; now: number }): SessionSummary[] {
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
			liveness: judge({ lastEventAt: last.ts, pid: last.pid, now }),
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

/** live: recent event; idle: older but the pid runs; ended: neither. */
function judge({ lastEventAt, pid, now }: { lastEventAt: string; pid: number; now: number }): Liveness {
	if (now - Date.parse(lastEventAt) < SESSION_IDLE_LIMIT_MS) return "live";
	if (isProcessRunning(pid)) return "idle";
	return "ended";
}
