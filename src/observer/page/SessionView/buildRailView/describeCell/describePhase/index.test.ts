import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import describePhase from "./index.js";

describe("describePhase", () => {
	it("reads a running phase as running", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "spec", state: "running" })] });
		expect(describePhase({ phase: "spec", ctx })).toMatchObject({ state: "run", meta: "Running" });
	});

	it("reads a finished phase as done", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "spec", state: "done" })] });
		expect(describePhase({ phase: "spec", ctx })).toEqual({ state: "done", meta: "Done", loop: null });
	});

	it("reads a phase that has not run as not started", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "spec", state: "not-run" })] });
		expect(describePhase({ phase: "spec", ctx })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("reads a phase the rail does not list as not started", () => {
		expect(describePhase({ phase: "research", ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("reads only its own phase's entry", () => {
		const ctx = makeRailContext({ phases: [makeRailPhase({ phase: "plan", state: "running" })] });
		expect(describePhase({ phase: "spec", ctx }).state).toBe("todo");
	});
});
