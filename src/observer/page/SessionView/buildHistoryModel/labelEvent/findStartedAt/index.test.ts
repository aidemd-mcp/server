import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findStartedAt from "./index.js";

type Finished = Extract<ObserverEvent, { kind: "phase_finished" }>;

function started({ seq, ts, phase = "qa", module = "m", sessionId = "s1" }: { seq: number; ts: string; phase?: "qa" | "fix"; module?: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts, sessionId, pid: 1, seq, kind: "phase_started", pipeline: "p1", phase, agent: "a", module };
}

const FINISHED: Finished = { v: 1, ts: "2026-01-01T10:00:00.000Z", sessionId: "s1", pid: 1, seq: 9, kind: "phase_finished", pipeline: "p1", phase: "qa", agent: "a", module: "m" };

describe("findStartedAt", () => {
	it("is the latest earlier start of the same session, phase and module", () => {
		const events = [started({ seq: 1, ts: "2026-01-01T09:00:00.000Z" }), started({ seq: 5, ts: "2026-01-01T09:30:00.000Z" })];
		expect(findStartedAt({ finished: FINISHED, events })).toBe("2026-01-01T09:30:00.000Z");
	});

	it("ignores a later start, another phase, module or session", () => {
		const events = [
			started({ seq: 10, ts: "2026-01-01T09:50:00.000Z" }),
			started({ seq: 2, ts: "2026-01-01T09:51:00.000Z", phase: "fix" }),
			started({ seq: 3, ts: "2026-01-01T09:52:00.000Z", module: "other" }),
			started({ seq: 4, ts: "2026-01-01T09:53:00.000Z", sessionId: "s2" }),
		];
		expect(findStartedAt({ finished: FINISHED, events })).toBeNull();
	});
});
