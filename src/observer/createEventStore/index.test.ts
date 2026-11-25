import { describe, expect, it } from "vitest";
import type { ObserverEvent, ProjectLog, SessionLog } from "@/types/index.js";
import createEventStore from "./index.js";

const A = "alpha-aaaaaa";
const B = "beta-bbbbbb";

function makeEvent({
	sessionId,
	seq,
	ts = `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
}: {
	sessionId: string;
	seq: number;
	ts?: string;
}): ObserverEvent {
	return { v: 1, ts, sessionId, seq, pid: 4242, kind: "prompt", text: `event ${seq}` };
}

function makeSessionLog({ sessionId, events }: { sessionId: string; events: ObserverEvent[] }): SessionLog {
	return { sessionId, started: null, events, skippedLines: 0, liveness: { state: "ended", lastActivityAt: null, quietMinutes: 0, maybeStuck: false }, unreadable: false };
}

function makeProject({ projectKey, sessions }: { projectKey: string; sessions: SessionLog[] }): ProjectLog {
	return { projectKey, projectRoot: null, sessions, unlinked: [] };
}

const seqsOf = (events: ObserverEvent[]): number[] => events.map((event) => event.seq);

describe("createEventStore", () => {
	it("holds events before ready and lists nothing", () => {
		const store = createEventStore();

		expect(store.isReady()).toBe(false);
		expect(store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A })).toBe("held");
		expect(store.sessions()).toEqual([]);
	});

	it("keeps one copy when a held event duplicates a replayed one", () => {
		const store = createEventStore();
		const shared = makeEvent({ sessionId: "a", seq: 2 });
		store.accept({ event: shared, projectKey: A });

		store.finishReplay([
			makeProject({
				projectKey: A,
				sessions: [
					makeSessionLog({
						sessionId: "a",
						events: [makeEvent({ sessionId: "a", seq: 1 }), makeEvent({ sessionId: "a", seq: 2 })],
					}),
				],
			}),
		]);

		expect(store.isReady()).toBe(true);
		const [session] = store.sessions();
		expect(seqsOf(session.events)).toEqual([1, 2]);
	});

	it("returns held events that arrived out of seq order in seq order", () => {
		const store = createEventStore();
		store.accept({ event: makeEvent({ sessionId: "a", seq: 3 }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "a", seq: 2 }), projectKey: A });

		store.finishReplay([]);

		expect(seqsOf(store.sessions()[0].events)).toEqual([1, 2, 3]);
	});

	it("reports a repeated post as a duplicate once ready", () => {
		const store = createEventStore();
		store.finishReplay([]);

		expect(store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A })).toBe("added");
		expect(store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A })).toBe("duplicate");
		expect(store.sessions()[0].events).toHaveLength(1);
	});

	it("inserts a late event at its seq position after ready", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "a", seq: 3 }), projectKey: A });

		store.accept({ event: makeEvent({ sessionId: "a", seq: 2 }), projectKey: A });

		expect(seqsOf(store.sessions()[0].events)).toEqual([1, 2, 3]);
	});

	it("keeps events of two sessions separate", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "b", seq: 1 }), projectKey: A });

		expect(store.accept({ event: makeEvent({ sessionId: "b", seq: 2 }), projectKey: A })).toBe("added");

		const sessions = store.sessions();
		expect(sessions.map((session) => session.sessionId)).toEqual(["a", "b"]);
		expect(seqsOf(sessions[0].events)).toEqual([1]);
		expect(seqsOf(sessions[1].events)).toEqual([1, 2]);
	});

	it("orders sessions by the ts of their first event, ties by sessionId", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "late", seq: 1, ts: "2026-01-02T00:00:00.000Z" }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "zeta", seq: 1, ts: "2026-01-01T00:00:00.000Z" }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "alpha", seq: 1, ts: "2026-01-01T00:00:00.000Z" }), projectKey: A });

		expect(store.sessions().map((session) => session.sessionId)).toEqual(["alpha", "zeta", "late"]);
	});

	it("returns copies so callers cannot mutate the held events", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A });

		store.sessions()[0].events.pop();

		expect(store.sessions()[0].events).toHaveLength(1);
	});

	it("drops only the named session and lets the same key be accepted again", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A });
		store.accept({ event: makeEvent({ sessionId: "b", seq: 1 }), projectKey: A });

		expect(store.drop({ projectKey: A, sessionId: "a" })).toBe(true);
		expect(store.drop({ projectKey: A, sessionId: "a" })).toBe(false);
		expect(store.sessions().map((session) => session.sessionId)).toEqual(["b"]);
		expect(store.accept({ event: makeEvent({ sessionId: "a", seq: 1 }), projectKey: A })).toBe("added");
	});
});

describe("createEventStore projects", () => {
	it("files replayed sessions of two projects under their own key", () => {
		const store = createEventStore();
		store.finishReplay([
			makeProject({
				projectKey: A,
				sessions: [makeSessionLog({ sessionId: "a1", events: [makeEvent({ sessionId: "a1", seq: 1 })] })],
			}),
			makeProject({
				projectKey: B,
				sessions: [makeSessionLog({ sessionId: "b1", events: [makeEvent({ sessionId: "b1", seq: 1 })] })],
			}),
		]);

		expect(store.sessions().map((session) => [session.projectKey, session.sessionId])).toEqual([
			[A, "a1"],
			[B, "b1"],
		]);
		expect(store.sessions({ projectKey: A }).map((session) => session.sessionId)).toEqual(["a1"]);
		expect(store.sessions({ projectKey: B }).map((session) => session.sessionId)).toEqual(["b1"]);
		expect(store.sessions({ projectKey: "other-cccccc" })).toEqual([]);
	});

	it("lands a post for each project under the right key after the replay", () => {
		const store = createEventStore();
		store.finishReplay([
			makeProject({
				projectKey: A,
				sessions: [makeSessionLog({ sessionId: "a1", events: [makeEvent({ sessionId: "a1", seq: 1 })] })],
			}),
			makeProject({
				projectKey: B,
				sessions: [makeSessionLog({ sessionId: "b1", events: [makeEvent({ sessionId: "b1", seq: 1 })] })],
			}),
		]);

		expect(store.accept({ event: makeEvent({ sessionId: "a1", seq: 2 }), projectKey: A })).toBe("added");
		expect(store.accept({ event: makeEvent({ sessionId: "b1", seq: 2 }), projectKey: B })).toBe("added");

		expect(seqsOf(store.sessions({ projectKey: A })[0].events)).toEqual([1, 2]);
		expect(seqsOf(store.sessions({ projectKey: B })[0].events)).toEqual([1, 2]);
	});

	it("refuses a post under another key than its session's and stores nothing", () => {
		const store = createEventStore();
		store.finishReplay([
			makeProject({
				projectKey: A,
				sessions: [makeSessionLog({ sessionId: "a1", events: [makeEvent({ sessionId: "a1", seq: 1 })] })],
			}),
		]);

		expect(store.accept({ event: makeEvent({ sessionId: "a1", seq: 2 }), projectKey: B })).toBe("project-mismatch");

		expect(seqsOf(store.sessions({ projectKey: A })[0].events)).toEqual([1]);
		expect(store.sessions({ projectKey: B })).toEqual([]);
	});

	it("refuses a mismatching key for a session first seen in a held post", () => {
		const store = createEventStore();
		expect(store.accept({ event: makeEvent({ sessionId: "s", seq: 1 }), projectKey: A })).toBe("held");

		expect(store.accept({ event: makeEvent({ sessionId: "s", seq: 2 }), projectKey: B })).toBe("project-mismatch");

		store.finishReplay([]);
		expect(seqsOf(store.sessions({ projectKey: A })[0].events)).toEqual([1]);
	});

	it("drops a held post whose key disagrees with the key its session has on disk", () => {
		const store = createEventStore();
		store.accept({ event: makeEvent({ sessionId: "a1", seq: 3 }), projectKey: B });

		store.finishReplay([
			makeProject({
				projectKey: A,
				sessions: [makeSessionLog({ sessionId: "a1", events: [makeEvent({ sessionId: "a1", seq: 1 })] })],
			}),
		]);

		expect(seqsOf(store.sessions({ projectKey: A })[0].events)).toEqual([1]);
		expect(store.sessions({ projectKey: B })).toEqual([]);
	});

	it("drops a session only under the key it is held under", () => {
		const store = createEventStore();
		store.finishReplay([]);
		store.accept({ event: makeEvent({ sessionId: "a1", seq: 1 }), projectKey: A });

		expect(store.drop({ projectKey: B, sessionId: "a1" })).toBe(false);
		expect(store.sessions({ projectKey: A })).toHaveLength(1);
		expect(store.drop({ projectKey: A, sessionId: "a1" })).toBe(true);
	});
});
