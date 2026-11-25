import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import describePhase from "./index.js";

describe("describePhase", () => {
	it("reads a running phase as running", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "spec", state: "running" })] });
		expect(describePhase({ phase: "spec", ctx })).toMatchObject({ state: "run", meta: "Running" });
	});

	it("reads a finished phase as done", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "spec", state: "done" })] });
		expect(describePhase({ phase: "spec", ctx })).toEqual({ state: "done", meta: "Done", loop: null });
	});

	it("reads a phase that has not run as not started", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "spec", state: "pending" })] });
		expect(describePhase({ phase: "spec", ctx })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("reads a skipped stage in the not-started look with `Skipped · <reason>`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "research", state: "skipped", reason: "domain known" })] });
		expect(describePhase({ phase: "research", ctx })).toEqual({ state: "todo", meta: "Skipped · domain known", loop: null, skipped: true });
	});

	it("reads a skipped stage that gave no reason as plain `Skipped`", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "research", state: "skipped" })] });
		expect(describePhase({ phase: "research", ctx }).meta).toBe("Skipped");
	});

	it("reads a phase the rail does not list as not started", () => {
		expect(describePhase({ phase: "research", ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
		expect(describePhase({ phase: "research", ctx: makeRailContext() })).not.toHaveProperty("skipped");
	});

	it("reads only its own phase's entry", () => {
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase: "plan", state: "running" })] });
		expect(describePhase({ phase: "spec", ctx }).state).toBe("todo");
	});
});
