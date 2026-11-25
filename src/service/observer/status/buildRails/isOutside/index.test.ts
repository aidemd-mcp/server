import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { RunningWork } from "../../types/index.js";
import isOutside from "./index.js";

function makeEvent(kind: ObserverEvent["kind"], seq: number, fields: Record<string, unknown> = {}): ObserverEvent {
	return { v: 2, ts: "2026-11-22T12:00:00.000Z", sessionId: "s1", seq, pid: 1, kind, ...fields } as ObserverEvent;
}

const prompt = (seq: number) => makeEvent("prompt", seq, { text: "hi" });
const written = (seq: number) => makeEvent("file_written", seq, { path: "src/a.ts", action: "updated" });
const commit = (seq: number) => makeEvent("commit", seq, { sha: "abcdef1" });

const RUNNING: RunningWork = {
	sessionId: "s1",
	phase: "build",
	agent: "a",
	module: "src/a",
	startedAt: "2026-11-22T12:00:00.000Z",
	elapsedMs: 0,
};

describe("isOutside", () => {
	it.each([
		["a file write", written(2)],
		["a commit", commit(2)],
	])("is true when the newest non-prompt event is %s", (_label, last) => {
		expect(isOutside({ sessionEvents: [prompt(1), last], running: null })).toBe(true);
	});

	it("ignores a newer prompt", () => {
		expect(isOutside({ sessionEvents: [written(1), prompt(2)], running: null })).toBe(true);
	});

	it("is false while a phase runs", () => {
		expect(isOutside({ sessionEvents: [written(1)], running: RUNNING })).toBe(false);
	});

	it("is false when the newest non-prompt event is a phase event", () => {
		const events = [written(1), makeEvent("phase_finished", 2, { phase: "plan", agent: "a", module: "src/a" })];

		expect(isOutside({ sessionEvents: events, running: null })).toBe(false);
	});

	it("is false with no events or only prompts", () => {
		expect(isOutside({ sessionEvents: [], running: null })).toBe(false);
		expect(isOutside({ sessionEvents: [prompt(1)], running: null })).toBe(false);
	});

	it("follows seq, not array order", () => {
		const events = [commit(5), makeEvent("phase_started", 3, { phase: "plan", agent: "a", module: "src/a" })];

		expect(isOutside({ sessionEvents: events, running: null })).toBe(true);
	});
});
