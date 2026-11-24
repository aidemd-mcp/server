import type { ObserverEvent, ProjectLog } from "@/types/index.js";
import type { EventStore, HeldSession } from "../types/index.js";

/**
 * Builds the observer's in-memory event store. Before the replay finishes
 * every accepted event is only held; `finishReplay` then merges the replayed
 * history of every project and the held posts through one dedupe on
 * (sessionId, seq) and flips the store to ready in a single synchronous turn,
 * so no post can land between "merged" and "ready". After that `accept`
 * dedupes and keeps each session in `seq` order.
 *
 * Each session belongs to the project key it was first seen under; a post
 * under another key is answered `project-mismatch` and stores nothing, so no
 * post can inject events into another project's session.
 */
export default function createEventStore(): EventStore {
	const bySession = new Map<string, ObserverEvent[]>();
	const ownerOf = new Map<string, string>();
	const keys = new Set<string>();
	let held: { event: ObserverEvent; projectKey: string }[] = [];
	let ready = false;

	const keyOf = (event: ObserverEvent): string => `${event.sessionId}:${event.seq}`;

	/** True when the session is already claimed by a project other than `projectKey`. */
	const claimedElsewhere = ({ sessionId, projectKey }: { sessionId: string; projectKey: string }): boolean => {
		const owner = ownerOf.get(sessionId);
		return owner !== undefined && owner !== projectKey;
	};

	/** Inserts one event at its `seq` position; false when its key is already held. */
	const insert = (event: ObserverEvent): boolean => {
		const key = keyOf(event);
		if (keys.has(key)) return false;
		keys.add(key);

		const events = bySession.get(event.sessionId);
		if (!events) {
			bySession.set(event.sessionId, [event]);
			return true;
		}

		// Walk back from the end: events almost always arrive in order.
		let index = events.length;
		while (index > 0 && events[index - 1].seq > event.seq) index -= 1;
		events.splice(index, 0, event);
		return true;
	};

	return {
		accept({ event, projectKey }) {
			if (claimedElsewhere({ sessionId: event.sessionId, projectKey })) return "project-mismatch";
			ownerOf.set(event.sessionId, projectKey);
			if (!ready) {
				held.push({ event, projectKey });
				return "held";
			}
			return insert(event) ? "added" : "duplicate";
		},

		finishReplay(projects: ProjectLog[]) {
			// The logs on disk are authoritative: claims made by held posts are re-derived after them.
			ownerOf.clear();
			for (const project of projects) {
				for (const session of project.sessions) {
					if (claimedElsewhere({ sessionId: session.sessionId, projectKey: project.projectKey })) continue;
					ownerOf.set(session.sessionId, project.projectKey);
					for (const event of session.events) insert(event);
				}
			}
			for (const { event, projectKey } of held) {
				if (claimedElsewhere({ sessionId: event.sessionId, projectKey })) continue;
				ownerOf.set(event.sessionId, projectKey);
				insert(event);
			}
			held = [];
			ready = true;
		},

		isReady() {
			return ready;
		},

		sessions({ projectKey } = {}) {
			const listing: HeldSession[] = [...bySession.entries()]
				.map(([sessionId, events]) => ({ projectKey: ownerOf.get(sessionId) as string, sessionId, events: [...events] }))
				.filter((session) => projectKey === undefined || session.projectKey === projectKey);
			return listing.sort((a, b) => {
				const byTime = a.events[0].ts.localeCompare(b.events[0].ts);
				return byTime !== 0 ? byTime : a.sessionId.localeCompare(b.sessionId);
			});
		},

		drop({ projectKey, sessionId }) {
			const events = bySession.get(sessionId);
			if (!events || ownerOf.get(sessionId) !== projectKey) return false;
			for (const event of events) keys.delete(keyOf(event));
			bySession.delete(sessionId);
			ownerOf.delete(sessionId);
			return true;
		},
	};
}
