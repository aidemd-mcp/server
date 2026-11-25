import type { SessionLiveness } from "@/types/index.js";
import type { HeldSession, SessionListing } from "../../types/index.js";

/**
 * Turns the held sessions into the rows of the sessions list. Each row's liveness is copied from
 * `liveness` (the recording side's judgement, read by `readHeldLiveness`); nothing is judged here, so
 * every listing agrees with the archive refusal. A session with no entry in `liveness` throws:
 * the caller asked for every session it passes.
 */
export default function summarizeSessions({
	sessions,
	liveness,
}: {
	sessions: HeldSession[];
	liveness: Record<string, SessionLiveness>;
}): SessionListing[] {
	return sessions.map(({ sessionId, events }) => {
		const judged = liveness[sessionId];
		if (judged === undefined) throw new Error(`No liveness was read for session ${sessionId}.`);
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
			liveness: judged,
		};
	});
}
