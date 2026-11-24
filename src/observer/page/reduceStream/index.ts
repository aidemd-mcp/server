import type { HeldSession } from "@/observer/types/index.js";
import type { ObserverEvent } from "@/types/index.js";
import type { StreamAction, StreamState } from "@/observer/page/types/index.js";

/** Returns the events in `seq` order without touching the input. */
function sortBySeq(events: ObserverEvent[]): ObserverEvent[] {
	return [...events].sort((a, b) => a.seq - b.seq);
}

/** Adds one event to the held sessions: creates its session when new, skips a `(sessionId, seq)` already held, keeps `seq` order. */
function insertEvent({
	held,
	projectKey,
	event,
}: {
	held: HeldSession[];
	projectKey: string;
	event: ObserverEvent;
}): HeldSession[] {
	const existing = held.find((session) => session.projectKey === projectKey && session.sessionId === event.sessionId);
	if (!existing) return [...held, { projectKey, sessionId: event.sessionId, events: [event] }];
	if (existing.events.some((held) => held.seq === event.seq)) return held;
	return held.map((session) =>
		session === existing ? { ...session, events: sortBySeq([...session.events, event]) } : session,
	);
}

/**
 * Folds one stream action into the page's held state: a snapshot replaces every held
 * session (a reconnect re-sends them all), an event is held once per `(sessionId, seq)` in
 * `seq` order, and status, session lists, project list and connection replace only their own
 * part. Pure; never mutates its input.
 */
export default function reduceStream(state: StreamState, action: StreamAction): StreamState {
	switch (action.name) {
		case "snapshot":
			return {
				...state,
				held: action.data.sessions.map((session) => ({ ...session, events: sortBySeq(session.events) })),
			};
		case "aide-event":
			return {
				...state,
				held: insertEvent({ held: state.held, projectKey: action.data.projectKey, event: action.data.event }),
			};
		case "status":
			return { ...state, views: { ...state.views, [action.data.projectKey]: action.data.view } };
		case "sessions":
			return { ...state, listings: { ...state.listings, [action.data.projectKey]: action.data.sessions } };
		case "projects":
			return { ...state, projects: action.data.projects };
		case "connection":
			return { ...state, connection: action.state };
	}
}
