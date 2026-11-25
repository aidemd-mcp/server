import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import describeLane from "./index.js";

describe("describeLane", () => {
	it("reads a running phase as `Running`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "align", state: "running" })] });
		expect(describeLane({ phase: "align", ctx })).toEqual({ state: "run", meta: "Running" });
	});

	it("reads a finished phase as `Done`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "cleanup", state: "done" })] });
		expect(describeLane({ phase: "cleanup", ctx })).toEqual({ state: "done", meta: "Done" });
	});

	it("reads a phase that has not run as `Not started`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "refactor", state: "pending" })] });
		expect(describeLane({ phase: "refactor", ctx })).toEqual({ state: "todo", meta: "Not started" });
		expect(describeLane({ phase: "refactor", ctx })).not.toHaveProperty("skipped");
	});

	it("reads a skipped lane in the not-started look with `Skipped · <reason>`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "structure", state: "skipped", reason: "no new folders" })] });
		expect(describeLane({ phase: "structure", ctx })).toEqual({ state: "todo", meta: "Skipped · no new folders", skipped: true });
	});

	it("reads a phase the rail does not list as `Not started`", () => {
		expect(describeLane({ phase: "structure", ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started" });
	});

	it("reads only the lane's own phase", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "align", state: "running" })] });
		expect(describeLane({ phase: "refactor", ctx }).state).toBe("todo");
	});
});
