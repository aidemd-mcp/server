import { describe, it, expect } from "vitest";
import type { ObserverEvent, SessionLiveness } from "@/types/index.js";
import foldSessions from "./index.js";

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

function iso(msBeforeNow: number): string {
	return new Date(NOW - msBeforeNow).toISOString();
}

function makeEvent(
	fields: { kind: "session_started" | "prompt" } & Record<string, unknown>,
	envelope: { sessionId?: string; seq?: number; ts?: string; pid?: number } = {},
): ObserverEvent {
	const base = {
		v: 1,
		ts: iso(0),
		sessionId: "s1",
		seq: 1,
		pid: 100,
		...envelope,
	};
	if (fields.kind === "prompt") return { ...base, text: "hi", ...fields } as ObserverEvent;
	return { ...base, ...fields } as ObserverEvent;
}

function makeLiveness(overrides: Partial<SessionLiveness> = {}): SessionLiveness {
	return { state: "working", lastActivityAt: iso(MINUTE), quietMinutes: 1, maybeStuck: false, ...overrides };
}

describe("foldSessions — liveness", () => {
	it.each<SessionLiveness>([
		makeLiveness({ state: "working" }),
		makeLiveness({ state: "waiting" }),
		makeLiveness({ state: "ended", endedBy: "user" }),
		makeLiveness({ state: "working", quietMinutes: 300, maybeStuck: true }),
	])("passes the given liveness through unchanged (%o)", (given) => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(5 * 60 * MINUTE) })];

		const [session] = foldSessions({ events, liveness: { s1: given } });

		expect(session.liveness).toBe(given);
	});

	it("never re-judges a session that has been idle for hours", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(6 * 60 * MINUTE), pid: 999999 })];
		const given = makeLiveness({ state: "waiting" });

		const [session] = foldSessions({ events, liveness: { s1: given } });

		expect(session.liveness.state).toBe("waiting");
	});

	it("gives each session its own liveness", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { sessionId: "a", ts: iso(10 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { sessionId: "b", ts: iso(2 * MINUTE) }),
		];
		const liveness = { a: makeLiveness({ state: "ended" }), b: makeLiveness({ state: "working" }) };

		const sessions = foldSessions({ events, liveness });

		expect(sessions.map((session) => [session.sessionId, session.liveness.state])).toEqual([
			["b", "working"],
			["a", "ended"],
		]);
	});

	it("reports the pid of the highest-seq event", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { seq: 2, pid: 222 }),
			makeEvent({ kind: "prompt" }, { seq: 1, pid: 111 }),
		];

		const [session] = foldSessions({ events, liveness: { s1: makeLiveness() } });

		expect(session.pid).toBe(222);
	});
});

describe("foldSessions — folding", () => {
	const liveness = { s1: makeLiveness() };

	it("follows seq, not array order, for startedAt and lastEventAt", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { seq: 3, ts: iso(1 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { seq: 1, ts: iso(10 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { seq: 2, ts: iso(5 * MINUTE) }),
		];

		const [session] = foldSessions({ events, liveness });

		expect(session.startedAt).toBe(iso(10 * MINUTE));
		expect(session.lastEventAt).toBe(iso(1 * MINUTE));
		expect(session.eventCount).toBe(3);
	});

	it("reports null when there is no session_started event", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(MINUTE) })];

		const [session] = foldSessions({ events, liveness });

		expect(session.reported).toBeNull();
	});

	it("reports only the keys the first session_started carries", () => {
		const events = [
			makeEvent(
				{ kind: "session_started", projectRoot: "/p", kanbanTag: "tag" },
				{ ts: iso(MINUTE) },
			),
		];

		const [session] = foldSessions({ events, liveness });

		expect(session.reported).toEqual({ projectRoot: "/p", kanbanTag: "tag" });
		expect(session.reported).not.toHaveProperty("brainPath");
	});

	it("uses the first session_started when there are several", () => {
		const events = [
			makeEvent({ kind: "session_started", projectRoot: "/second" }, { seq: 2, ts: iso(MINUTE) }),
			makeEvent({ kind: "session_started", projectRoot: "/first" }, { seq: 1, ts: iso(2 * MINUTE) }),
		];

		const [session] = foldSessions({ events, liveness });

		expect(session.reported).toEqual({ projectRoot: "/first" });
	});

	it("orders sessions newest startedAt first", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { sessionId: "old", ts: iso(10 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { sessionId: "new", ts: iso(2 * MINUTE) }),
		];

		const sessions = foldSessions({ events, liveness: { old: makeLiveness(), new: makeLiveness() } });

		expect(sessions.map((session) => session.sessionId)).toEqual(["new", "old"]);
	});

	it("breaks startedAt ties by sessionId descending", () => {
		const ts = iso(MINUTE);
		const events = [
			makeEvent({ kind: "prompt" }, { sessionId: "a", ts }),
			makeEvent({ kind: "prompt" }, { sessionId: "c", ts }),
			makeEvent({ kind: "prompt" }, { sessionId: "b", ts }),
		];

		const sessions = foldSessions({
			events,
			liveness: { a: makeLiveness(), b: makeLiveness(), c: makeLiveness() },
		});

		expect(sessions.map((session) => session.sessionId)).toEqual(["c", "b", "a"]);
	});

	it("returns nothing for no events", () => {
		expect(foldSessions({ events: [], liveness: {} })).toEqual([]);
	});
});
