import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import orderEvents from "./index.js";

function prompt({ sessionId, seq, ts }: { sessionId: string; seq: number; ts: string }): ObserverEvent {
	return { v: 1, ts, sessionId, pid: 1, seq, kind: "prompt", text: `${sessionId}#${seq}` };
}

const key = (event: ObserverEvent): string => `${event.sessionId}#${event.seq}`;

describe("orderEvents", () => {
	it("keeps each session in its own seq order and merges the sessions by time", () => {
		const events = [
			prompt({ sessionId: "b", seq: 2, ts: "2026-01-01T10:03:00.000Z" }),
			prompt({ sessionId: "a", seq: 2, ts: "2026-01-01T10:02:00.000Z" }),
			prompt({ sessionId: "b", seq: 1, ts: "2026-01-01T10:01:00.000Z" }),
			prompt({ sessionId: "a", seq: 1, ts: "2026-01-01T10:00:00.000Z" }),
		];
		expect(orderEvents({ events, sessionIds: ["a", "b"] }).map(key)).toEqual(["a#1", "b#1", "a#2", "b#2"]);
	});

	it("breaks a tie in time by the lower session id", () => {
		const events = [prompt({ sessionId: "b", seq: 1, ts: "2026-01-01T10:00:00.000Z" }), prompt({ sessionId: "a", seq: 1, ts: "2026-01-01T10:00:00.000Z" })];
		expect(orderEvents({ events, sessionIds: ["b", "a"] }).map(key)).toEqual(["a#1", "b#1"]);
	});

	it("keeps seq order inside a session even when a later event carries an earlier time, and drops other sessions", () => {
		const events = [
			prompt({ sessionId: "a", seq: 2, ts: "2026-01-01T09:00:00.000Z" }),
			prompt({ sessionId: "a", seq: 1, ts: "2026-01-01T10:00:00.000Z" }),
			prompt({ sessionId: "c", seq: 1, ts: "2026-01-01T08:00:00.000Z" }),
		];
		expect(orderEvents({ events, sessionIds: ["a"] }).map(key)).toEqual(["a#1", "a#2"]);
	});

	it("is empty with no event or no session", () => {
		expect(orderEvents({ events: [], sessionIds: ["a"] })).toEqual([]);
		expect(orderEvents({ events: [prompt({ sessionId: "a", seq: 1, ts: "2026-01-01T10:00:00.000Z" })], sessionIds: [] })).toEqual([]);
	});
});
