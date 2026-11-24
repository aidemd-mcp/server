import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import describeRunning from "./index.js";

const ctx = (phase: "spec" | "build" | "fix", withWork: boolean) =>
	makeRailContext({ status: makeStatus({ generatedAt: NOW.toISOString(), running: withWork ? [makeWork({ phase, elapsedMs: 125_000 })] : [] }) });

describe("describeRunning", () => {
	it("reads `Running <elapsed>` for an ordinary phase", () => {
		const entry = makeRailPhase({ phase: "spec", state: "running" });
		expect(describeRunning({ phase: "spec", entry, ctx: ctx("spec", true) })).toEqual({ state: "run", meta: "Running 2m 05s", loop: null });
	});

	it("leaves the elapsed part out when the status has no running work to count from", () => {
		const entry = makeRailPhase({ phase: "spec", state: "running" });
		expect(describeRunning({ phase: "spec", entry, ctx: ctx("spec", false) })).toEqual({ state: "run", meta: "Running", loop: null });
	});

	it("reads Build as `Step <n> of <m>` once the plan's steps are known", () => {
		const entry = makeRailPhase({ phase: "build", state: "running", buildStep: { reached: 4, total: 9 } });
		expect(describeRunning({ phase: "build", entry, ctx: ctx("build", true) })).toEqual({ state: "run", meta: "Step 4 of 9", loop: null });
	});

	it("reads a Build with no known steps like any other phase", () => {
		const entry = makeRailPhase({ phase: "build", state: "running" });
		expect(describeRunning({ phase: "build", entry, ctx: ctx("build", true) }).meta).toBe("Running 2m 05s");
	});

	it("reads Fix as `Round <r> · <elapsed>` with the round as its loop badge", () => {
		const entry = makeRailPhase({ phase: "fix", state: "running", qaFixRound: 2 });
		expect(describeRunning({ phase: "fix", entry, ctx: ctx("fix", true) })).toEqual({ state: "run", meta: "Round 2 · 2m 05s", loop: "round 2" });
	});

	it("reads Fix as `Round <r>` alone when there is no elapsed time", () => {
		const entry = makeRailPhase({ phase: "fix", state: "running", qaFixRound: 2 });
		expect(describeRunning({ phase: "fix", entry, ctx: ctx("fix", false) })).toEqual({ state: "run", meta: "Round 2", loop: "round 2" });
	});

	it("reads a Fix with no reported round as an ordinary running phase", () => {
		const entry = makeRailPhase({ phase: "fix", state: "running" });
		expect(describeRunning({ phase: "fix", entry, ctx: ctx("fix", true) })).toEqual({ state: "run", meta: "Running 2m 05s", loop: null });
	});
});
