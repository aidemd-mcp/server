import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import findPhaseDuration from "./index.js";

const started = (seq: number, ts: string, phase = "build") => makeEvent({ seq, ts, kind: "phase_started", phase, agent: "a", module: "src/a" });
const finished = (seq: number, ts: string, phase = "build") => makeEvent({ seq, ts, kind: "phase_finished", phase, agent: "a", module: "src/a" });

describe("findPhaseDuration", () => {
	it("is the span from the start event to the finish event, written the handoff's way", () => {
		const events = [started(1, "2026-11-23T14:00:00.000Z"), finished(2, "2026-11-23T14:06:02.000Z")];
		expect(findPhaseDuration({ pipelineEvents: events, phase: "build" })).toBe("6m 02s");
	});

	it("is null when the phase never finished", () => {
		expect(findPhaseDuration({ pipelineEvents: [started(1, "2026-11-23T14:00:00.000Z")], phase: "build" })).toBeNull();
	});

	it("is null when the start was never reported", () => {
		expect(findPhaseDuration({ pipelineEvents: [finished(2, "2026-11-23T14:06:02.000Z")], phase: "build" })).toBeNull();
	});

	it("measures the latest run: the newest finish from the newest earlier start", () => {
		const events = [
			started(1, "2026-11-23T14:00:00.000Z"),
			finished(2, "2026-11-23T14:10:00.000Z"),
			started(3, "2026-11-23T14:20:00.000Z"),
			finished(4, "2026-11-23T14:20:45.000Z"),
		];
		expect(findPhaseDuration({ pipelineEvents: events, phase: "build" })).toBe("45s");
	});

	it("ignores a start that comes after the finish", () => {
		const events = [finished(2, "2026-11-23T14:06:02.000Z"), started(3, "2026-11-23T14:07:00.000Z")];
		expect(findPhaseDuration({ pipelineEvents: events, phase: "build" })).toBeNull();
	});

	it("ignores events of other phases", () => {
		const events = [started(1, "2026-11-23T14:00:00.000Z", "qa"), finished(2, "2026-11-23T14:06:02.000Z", "build")];
		expect(findPhaseDuration({ pipelineEvents: events, phase: "build" })).toBeNull();
	});
});
