import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import describeDone from "./index.js";

const PASSED_AT = new Date(2026, 10, 23, 14, 7).toISOString();
const verdict = (seq: number, result: "passed" | "issues", ts: string) => makeEvent({ seq, ts, kind: "qa_verdict", pipeline: "p1", module: "src/tools/score", verdict: result });

describe("describeDone", () => {
	it("is not started with no verdict", () => {
		expect(describeDone({ ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("is done with the clock time of a passing verdict", () => {
		const ctx = makeRailContext({ pipelineEvents: [verdict(1, "passed", PASSED_AT)] });
		expect(describeDone({ ctx })).toEqual({ state: "done", meta: "Done 14:07", loop: null });
	});

	it("is not started when the newest verdict found issues", () => {
		const ctx = makeRailContext({ pipelineEvents: [verdict(1, "passed", PASSED_AT), verdict(2, "issues", PASSED_AT)] });
		expect(describeDone({ ctx }).state).toBe("todo");
	});

	it("is done when the newest verdict passed after earlier issues", () => {
		const ctx = makeRailContext({ pipelineEvents: [verdict(1, "issues", PASSED_AT), verdict(2, "passed", PASSED_AT)] });
		expect(describeDone({ ctx }).state).toBe("done");
	});
});
