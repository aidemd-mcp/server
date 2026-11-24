import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import describeLane from "./index.js";

describe("describeLane", () => {
	it("reads a running phase as `Running`", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "align", state: "running" })] });
		expect(describeLane({ phase: "align", ctx })).toEqual({ state: "run", meta: "Running" });
	});

	it("reads a finished phase as `Done`", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "cleanup", state: "done" })] });
		expect(describeLane({ phase: "cleanup", ctx })).toEqual({ state: "done", meta: "Done" });
	});

	it("reads a phase that has not run as `Not started`", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "refactor", state: "not-run" })] });
		expect(describeLane({ phase: "refactor", ctx })).toEqual({ state: "todo", meta: "Not started" });
	});

	it("reads a phase the rail does not list as `Not started`", () => {
		expect(describeLane({ phase: "structure", ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started" });
	});

	it("reads only the lane's own phase", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "align", state: "running" })] });
		expect(describeLane({ phase: "refactor", ctx }).state).toBe("todo");
	});
});
