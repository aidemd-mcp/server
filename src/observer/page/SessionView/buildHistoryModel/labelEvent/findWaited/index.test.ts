import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findWaited from "./index.js";

type Resolved = Extract<ObserverEvent, { kind: "gate_resolved" }>;

function waiting({ seq, ts, file = "m/plan.aide", sessionId = "s1" }: { seq: number; ts: string; file?: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts, sessionId, pid: 1, seq, kind: "gate_waiting", gate: "approve", file };
}

const RESOLVED: Resolved = { v: 1, ts: "2026-01-01T10:00:00.000Z", sessionId: "s1", pid: 1, seq: 9, kind: "gate_resolved", gate: "approve", file: "m/plan.aide" };
const sameFile = (file: string): boolean => file === "m/plan.aide";

describe("findWaited", () => {
	it("is the latest earlier waiting event for the file in the session", () => {
		const events = [waiting({ seq: 1, ts: "2026-01-01T09:00:00.000Z" }), waiting({ seq: 4, ts: "2026-01-01T09:30:00.000Z" })];
		expect(findWaited({ resolved: RESOLVED, events, sameFile })).toBe("2026-01-01T09:30:00.000Z");
	});

	it("is null when only another file's, session's or later waiting event is held", () => {
		const events = [
			waiting({ seq: 2, ts: "2026-01-01T09:00:00.000Z", file: "other/plan.aide" }),
			waiting({ seq: 3, ts: "2026-01-01T09:00:00.000Z", sessionId: "s2" }),
			waiting({ seq: 12, ts: "2026-01-01T10:30:00.000Z" }),
		];
		expect(findWaited({ resolved: RESOLVED, events, sameFile })).toBeNull();
	});
});
