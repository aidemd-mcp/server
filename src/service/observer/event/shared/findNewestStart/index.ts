import type { ObserverEvent, SessionStartedEvent } from "@/service/observer/event/shared/schema/index.js";

/**
 * The one rule for "what the newest session reported" (brief commitments #12, #35, #38): across the
 * given sessions, the `session_started` event with the greatest `ts`. It returns that recorded
 * event itself, so a field it never carried stays absent and an older session never fills the gap.
 * No `session_started` anywhere gives null. Read (project root) and the observer (board location)
 * both use it. Pure.
 */
export default function findNewestStart({
	sessions,
}: {
	sessions: { events: ObserverEvent[] }[];
}): SessionStartedEvent | null {
	let newest: SessionStartedEvent | null = null;
	for (const session of sessions) {
		for (const event of session.events) {
			if (event.kind !== "session_started") continue;
			if (newest === null || event.ts > newest.ts) newest = event;
		}
	}
	return newest;
}
