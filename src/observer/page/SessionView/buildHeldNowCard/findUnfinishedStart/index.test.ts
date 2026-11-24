import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findUnfinishedStart from "./index.js";

function phase({ seq, kind, name, module, sessionId = "s1" }: { seq: number; kind: "phase_started" | "phase_finished"; name: string; module: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId, pid: 1, seq, kind, phase: name, agent: "a", module } as ObserverEvent;
}

describe("findUnfinishedStart", () => {
	it("is null with nothing started or everything finished", () => {
		expect(findUnfinishedStart({ events: [], sessionId: "s1" })).toBeNull();
		const events = [phase({ seq: 1, kind: "phase_started", name: "spec", module: "m" }), phase({ seq: 2, kind: "phase_finished", name: "spec", module: "m" })];
		expect(findUnfinishedStart({ events, sessionId: "s1" })).toBeNull();
	});

	it("is the newest start that has no later finish, whatever order the events arrive in", () => {
		const events = [
			phase({ seq: 3, kind: "phase_started", name: "build", module: "m" }),
			phase({ seq: 1, kind: "phase_started", name: "spec", module: "m" }),
			phase({ seq: 2, kind: "phase_finished", name: "spec", module: "m" }),
		];
		expect(findUnfinishedStart({ events, sessionId: "s1" })?.phase).toBe("build");
	});

	it("keeps an earlier start open when a later one finishes", () => {
		const events = [
			phase({ seq: 1, kind: "phase_started", name: "spec", module: "m" }),
			phase({ seq: 2, kind: "phase_started", name: "align", module: "m" }),
			phase({ seq: 3, kind: "phase_finished", name: "align", module: "m" }),
		];
		expect(findUnfinishedStart({ events, sessionId: "s1" })?.phase).toBe("spec");
	});

	it("reads only the named session", () => {
		const events = [phase({ seq: 1, kind: "phase_started", name: "spec", module: "m", sessionId: "s2" })];
		expect(findUnfinishedStart({ events, sessionId: "s1" })).toBeNull();
		expect(findUnfinishedStart({ events, sessionId: null })).toBeNull();
	});
});
