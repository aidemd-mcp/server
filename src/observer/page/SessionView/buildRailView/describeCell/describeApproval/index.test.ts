import { describe, expect, it } from "vitest";
import type { WaitingFile } from "@/types/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import describeApproval from "./index.js";

const FILE = "src/tools/score/plan.aide";
const ago = (seconds: number): string => new Date(NOW.getTime() - seconds * 1000).toISOString();

const waitingFile = (overrides: Partial<WaitingFile> = {}): WaitingFile => ({ file: FILE, folder: "src/tools/score", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: ago(360), ...overrides });
const opened = (seq: number, ts: string, file = FILE) => makeEvent({ seq, ts, kind: "gate_waiting", gate: "approve plan", file });
const resolved = (seq: number, ts: string, file = FILE) => makeEvent({ seq, ts, kind: "gate_resolved", gate: "approve plan", file, resolution: "approved" });

describe("describeApproval", () => {
	it("is not started with no gate event", () => {
		expect(describeApproval({ ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("waits, with how long, while the module's plan gate is open in the status", () => {
		const ctx = makeRailContext({ status: makeStatus({ waiting: [waitingFile()] }) });
		expect(describeApproval({ ctx })).toEqual({ state: "wait", meta: "Waiting · 6m", loop: null });
	});

	it("ignores an open gate of another module or on another kind of file", () => {
		const status = makeStatus({ waiting: [waitingFile({ folder: "src/other" }), waitingFile({ kind: "todo" })] });
		expect(describeApproval({ ctx: makeRailContext({ status }) }).state).toBe("todo");
	});

	it("is done with how long the gate stood open once it was resolved", () => {
		const sessionEvents = [opened(1, "2026-11-23T14:00:00.000Z"), resolved(2, "2026-11-23T14:02:10.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ sessionEvents }) })).toEqual({ state: "done", meta: "Approved 2m 10s", loop: null });
	});

	it("is plain `Approved` when the opening event is not held", () => {
		const sessionEvents = [resolved(2, "2026-11-23T14:02:10.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ sessionEvents }) })).toEqual({ state: "done", meta: "Approved", loop: null });
	});

	it("matches the plan file whatever form the event recorded it in", () => {
		const absolute = "/work/app/src/tools/score/plan.aide";
		const sessionEvents = [opened(1, "2026-11-23T14:00:00.000Z", absolute), resolved(2, "2026-11-23T14:00:30.000Z", absolute)];
		expect(describeApproval({ ctx: makeRailContext({ sessionEvents }) }).meta).toBe("Approved 30s");
	});

	it("ignores a gate on another file", () => {
		const sessionEvents = [opened(1, "2026-11-23T14:00:00.000Z", "src/other/plan.aide"), resolved(2, "2026-11-23T14:00:30.000Z", "src/other/plan.aide")];
		expect(describeApproval({ ctx: makeRailContext({ sessionEvents }) }).state).toBe("todo");
	});

	it("looks for the root module's plan under `.aide/plan.aide`", () => {
		const root = ".aide/plan.aide";
		const sessionEvents = [opened(1, "2026-11-23T14:00:00.000Z", root), resolved(2, "2026-11-23T14:01:00.000Z", root)];
		expect(describeApproval({ ctx: makeRailContext({ module: ".", sessionEvents }) }).meta).toBe("Approved 1m 00s");
	});

	it("is not started when the gate opened but was never resolved", () => {
		const sessionEvents = [opened(1, "2026-11-23T14:00:00.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ sessionEvents }) }).state).toBe("todo");
	});
});
