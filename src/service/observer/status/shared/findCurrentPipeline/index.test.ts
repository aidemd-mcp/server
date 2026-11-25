import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findCurrentPipeline from "./index.js";

function makeEvent(seq: number, kind: ObserverEvent["kind"], fields: Record<string, unknown> = {}): ObserverEvent {
	return { v: 2, ts: "2026-11-22T12:00:00.000Z", sessionId: "s1", seq, pid: 100, kind, ...fields } as ObserverEvent;
}

const pStarted = (seq: number, pipeline: string) => makeEvent(seq, "pipeline_started", { pipeline, phase: "spec" });
const pFinished = (seq: number, pipeline: string) =>
	makeEvent(seq, "pipeline_finished", { pipeline, result: "completed" });
const phaseStarted = (seq: number, pipeline?: string) =>
	makeEvent(seq, "phase_started", { phase: "build", agent: "a", module: "src/x", ...(pipeline ? { pipeline } : {}) });

describe("findCurrentPipeline", () => {
	it.each([
		["started", [pStarted(1, "login")], { pipeline: "login", state: "running" }],
		["started then finished", [pStarted(1, "login"), pFinished(2, "login")], { pipeline: "login", state: "finished" }],
		[
			"a second pipeline started after the first finished",
			[pStarted(1, "login"), pFinished(2, "login"), pStarted(3, "export")],
			{ pipeline: "export", state: "running" },
		],
		[
			"events out of order are sorted by seq",
			[pFinished(2, "login"), pStarted(1, "login")],
			{ pipeline: "login", state: "finished" },
		],
		[
			"phase events with a pipeline but no start",
			[phaseStarted(1, "login"), phaseStarted(2, "export")],
			{ pipeline: "export", state: "running" },
		],
		[
			"a boundary event beats a later phase event of another pipeline",
			[pStarted(1, "login"), phaseStarted(2, "export")],
			{ pipeline: "login", state: "running" },
		],
	])("%s", (_name, events, expected) => {
		expect(findCurrentPipeline({ events })).toEqual(expected);
	});

	it.each([
		["no events", []],
		["v1 phase events with no pipeline", [phaseStarted(1), phaseStarted(2)]],
	])("returns null for %s", (_name, events) => {
		expect(findCurrentPipeline({ events })).toBeNull();
	});
});
