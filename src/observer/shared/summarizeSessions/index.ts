import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import type { HeldSession, SessionListing } from "../../types/index.js";

/**
 * Turns the held sessions into the rows of the sessions list. Liveness comes from event's
 * `judgeLiveness`, the same rule its delete refusal uses, so the list and the delete never disagree.
 */
export default function summarizeSessions({
	sessions,
	now,
}: {
	sessions: HeldSession[];
	now: number;
}): SessionListing[] {
	return sessions.map(({ sessionId, events }) => {
		const started = events.find((event) => event.kind === "session_started");
		const anchor = started ?? events[0];
		const metadata =
			started === undefined
				? null
				: {
						...(started.projectRoot !== undefined && { projectRoot: started.projectRoot }),
						...(started.kanbanTag !== undefined && { kanbanTag: started.kanbanTag }),
						...(started.brainPath !== undefined && { brainPath: started.brainPath }),
					};
		return {
			sessionId,
			startedAt: anchor?.ts ?? null,
			metadata,
			eventCount: events.length,
			lastEventAt: events.at(-1)?.ts ?? null,
			live: judgeLiveness({ events, now }),
		};
	});
}
