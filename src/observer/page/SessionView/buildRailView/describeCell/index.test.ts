import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeRailPhase from "@/observer/page/__fixtures__/makeRailPhase/index.js";
import type { RailSlot } from "@/observer/page/types/index.js";
import describeCell from "./index.js";

const FILE = "src/tools/score/plan.aide";
const gate = makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "gate_resolved", pipeline: "p1", gate: "approve plan", file: FILE });
const verdict = makeEvent({ seq: 2, ts: "2026-11-23T14:10:00.000Z", kind: "qa_verdict", pipeline: "p1", module: "src/tools/score", verdict: "issues", open: 2 });

describe("describeCell", () => {
	it("reads Plan approval from the gate events", () => {
		const ctx = makeRailContext({ pipelineEvents: [gate] });
		expect(describeCell({ slot: "approval", ctx })).toEqual({ state: "done", meta: "Approved", loop: null });
	});

	it("reads Done from the QA verdict, not from a phase", () => {
		const ctx = makeRailContext({ pipelineEvents: [verdict] });
		expect(describeCell({ slot: "done", ctx }).state).toBe("todo");
	});

	it("reads QA with its verdict overlaid on the phase", () => {
		const ctx = makeRailContext({ pipelineEvents: [verdict] });
		expect(describeCell({ slot: "qa", ctx })).toEqual({ state: "fail", meta: "2 issues · round 1", loop: null });
	});

	it.each<RailSlot>(["spec", "research", "synthesize", "plan", "build", "fix"])("reads %s as its phase as the rail reports it", (slot) => {
		const phase = slot as "spec";
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase, state: "running" })] });
		expect(describeCell({ slot, ctx }).state).toBe("run");
		expect(describeCell({ slot, ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it.each<RailSlot>(["spec", "research", "synthesize", "plan", "build", "qa", "fix"])("reads a skipped %s stage in the not-started look, worded `Skipped · <reason>`", (slot) => {
		const phase = slot as "spec";
		const ctx = makeRailContext({ stages: [makeRailPhase({ phase, state: "skipped", reason: "spec already approved" })] });
		expect(describeCell({ slot, ctx })).toEqual({ state: "todo", meta: "Skipped · spec already approved", loop: null, skipped: true });
	});
});
