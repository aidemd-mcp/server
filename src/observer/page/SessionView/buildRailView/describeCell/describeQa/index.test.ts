import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import describeQa from "./index.js";

const verdict = (seq: number, result: "passed" | "issues", open?: number) =>
	makeEvent({ seq, ts: "2026-11-23T14:10:00.000Z", kind: "qa_verdict", module: "src/tools/score", verdict: result, ...(open === undefined ? {} : { open }) });
const phaseEvent = (seq: number, kind: "phase_started" | "phase_finished", ts: string) => makeEvent({ seq, ts, kind, phase: "qa", agent: "aide-qa", module: "src/tools/score" });

describe("describeQa", () => {
	it("is whatever the rail reports for the phase when no verdict exists", () => {
		expect(describeQa({ ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
		const done = makeRailContext({ phases: [makeRailPhase({ phase: "qa", state: "done" })] });
		expect(describeQa({ ctx: done }).state).toBe("done");
	});

	it("reads as running while QA runs, whatever an earlier round found", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "qa", state: "running" })], moduleEvents: [verdict(1, "issues", 3)] });
		expect(describeQa({ ctx })).toMatchObject({ state: "run", meta: "Running" });
	});

	it("reads the newest `issues` verdict as `fail` with its open count and round", () => {
		const ctx = makeRailContext({ moduleEvents: [verdict(1, "issues", 4), verdict(2, "issues", 2)] });
		expect(describeQa({ ctx })).toEqual({ state: "fail", meta: "2 issues · round 2", loop: null });
	});

	it("says `1 issue` for one", () => {
		expect(describeQa({ ctx: makeRailContext({ moduleEvents: [verdict(1, "issues", 1)] }) }).meta).toBe("1 issue · round 1");
	});

	it("leaves the count out when the verdict did not report one", () => {
		expect(describeQa({ ctx: makeRailContext({ moduleEvents: [verdict(1, "issues")] }) }).meta).toBe("issues · round 1");
	});

	it("reads a passing verdict as done with the phase's duration", () => {
		const moduleEvents = [phaseEvent(1, "phase_started", "2026-11-23T14:00:00.000Z"), phaseEvent(2, "phase_finished", "2026-11-23T14:03:00.000Z"), verdict(3, "passed", 0)];
		expect(describeQa({ ctx: makeRailContext({ moduleEvents }) })).toEqual({ state: "done", meta: "Passed 3m 00s", loop: null });
	});

	it("reads a passing verdict as plain `Passed` when the duration is unknown", () => {
		expect(describeQa({ ctx: makeRailContext({ moduleEvents: [verdict(1, "passed")] }) })).toEqual({ state: "done", meta: "Passed", loop: null });
	});
});
