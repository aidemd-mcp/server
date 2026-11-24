import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import findSessionStart from "./index.js";

const ROW: SessionRowModel = { sessionId: "s1", startedAt: "2026-11-23T14:02:00.000Z", lastEventAt: null, eventCount: 2, liveness: "live", task: null, label: null };

function prompt({ seq, ts, sessionId = "s2" }: { seq: number; ts: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts, sessionId, seq, pid: 1, kind: "prompt", text: "hi" };
}

describe("findSessionStart", () => {
	it("prefers the listed start", () => {
		expect(findSessionStart({ sessionId: "s1", sessions: [ROW], events: [prompt({ seq: 1, ts: "2026-11-23T09:00:00.000Z", sessionId: "s1" })] })).toBe("2026-11-23T14:02:00.000Z");
	});

	it("falls back to the session's first held event", () => {
		const events = [prompt({ seq: 2, ts: "2026-11-23T09:05:00.000Z" }), prompt({ seq: 1, ts: "2026-11-23T09:00:00.000Z" })];
		expect(findSessionStart({ sessionId: "s2", sessions: [ROW], events })).toBe("2026-11-23T09:00:00.000Z");
	});

	it("is null for a session nothing names", () => {
		expect(findSessionStart({ sessionId: "s9", sessions: [ROW], events: [] })).toBeNull();
	});
});
