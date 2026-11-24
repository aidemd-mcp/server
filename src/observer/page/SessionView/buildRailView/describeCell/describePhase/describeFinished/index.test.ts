import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import describeFinished from "./index.js";

const events = [
	makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "phase_started", phase: "spec", agent: "a", module: "src/tools/score" }),
	makeEvent({ seq: 2, ts: "2026-11-23T14:06:02.000Z", kind: "phase_finished", phase: "spec", agent: "a", module: "src/tools/score" }),
];

describe("describeFinished", () => {
	it("reads `Done <duration>` from the phase's start and finish events", () => {
		expect(describeFinished({ phase: "spec", ctx: makeRailContext({ moduleEvents: events }) })).toEqual({ state: "done", meta: "Done 6m 02s", loop: null });
	});

	it("reads plain `Done` when the duration was never reported", () => {
		expect(describeFinished({ phase: "spec", ctx: makeRailContext() })).toEqual({ state: "done", meta: "Done", loop: null });
	});

	it("reads Build as `Done <done> of <total>` from the plan's own steps", () => {
		const ctx = makeRailContext({ status: makeStatus({ tree: [SCORE_NODE] }), moduleEvents: events });
		expect(describeFinished({ phase: "build", ctx })).toEqual({ state: "done", meta: "Done 3 of 9", loop: null });
	});

	it("falls back to Build's duration when the plan file is gone", () => {
		const build = [
			makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "phase_started", phase: "build", agent: "a", module: "src/tools/score" }),
			makeEvent({ seq: 2, ts: "2026-11-23T14:03:00.000Z", kind: "phase_finished", phase: "build", agent: "a", module: "src/tools/score" }),
		];
		const ctx = makeRailContext({ status: makeStatus(), moduleEvents: build });
		expect(describeFinished({ phase: "build", ctx })).toEqual({ state: "done", meta: "Done 3m 00s", loop: null });
	});
});
