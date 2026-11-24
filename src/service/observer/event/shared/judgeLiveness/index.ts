import isProcessRunning from "@/util/isProcessRunning/index.js";
import SESSION_IDLE_LIMIT_MS from "@/util/sessionIdleLimit/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

/**
 * The one liveness rule for a session's events (brief commitments #18, #28, #31).
 * A session is live when the process that wrote its last event is still
 * running, or, when that process is gone, when the last event is younger than
 * the shared `SESSION_IDLE_LIMIT_MS` (commitment #31). Shared because `read`, `delete` and src/observer's sessions
 * list must all judge a session the same way. Pure apart from the pid probe.
 */
export default function judgeLiveness({ events, now }: { events: ObserverEvent[]; now: number }): boolean {
	if (events.length === 0) return false;

	// The highest seq is the session's latest event, wherever it sits in the array.
	const last = events.reduce((latest, event) => (event.seq > latest.seq ? event : latest));

	if (isProcessRunning(last.pid)) return true;

	return now - Date.parse(last.ts) < SESSION_IDLE_LIMIT_MS;
}
