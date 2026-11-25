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
const opened = (seq: number, ts: string, file = FILE) => makeEvent({ seq, ts, kind: "gate_waiting", pipeline: "p1", gate: "approve plan", file });
const resolved = (seq: number, ts: string, file = FILE) => makeEvent({ seq, ts, kind: "gate_resolved", pipeline: "p1", gate: "approve plan", file, resolution: "approved" });

describe("describeApproval", () => {
	it("is not started with no gate event", () => {
		expect(describeApproval({ ctx: makeRailContext() })).toEqual({ state: "todo", meta: "Not started", loop: null });
	});

	it("waits, with how long, while a gate of the pipeline names a plan the status still lists as waiting", () => {
		const ctx = makeRailContext({ status: makeStatus({ waiting: [waitingFile()] }), pipelineEvents: [opened(2, ago(360))] });
		expect(describeApproval({ ctx })).toEqual({ state: "wait", meta: "Waiting · 6m", loop: null });
	});

	it("does not wait on a plan the status lists but no gate event of the pipeline names", () => {
		const ctx = makeRailContext({ status: makeStatus({ waiting: [waitingFile()] }), pipelineEvents: [] });
		expect(describeApproval({ ctx }).state).toBe("todo");
	});

	it("does not wait on a gate the status no longer lists, nor on a waiting file of another kind", () => {
		const events = [opened(2, ago(360))];
		expect(describeApproval({ ctx: makeRailContext({ status: makeStatus(), pipelineEvents: events }) }).state).toBe("todo");
		const todoOnly = makeStatus({ waiting: [waitingFile({ kind: "todo" })] });
		expect(describeApproval({ ctx: makeRailContext({ status: todoOnly, pipelineEvents: events }) }).state).toBe("todo");
	});

	it("is done with how long the gate stood open once it was resolved", () => {
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z"), resolved(2, "2026-11-23T14:02:10.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) })).toEqual({ state: "done", meta: "Approved 2m 10s", loop: null });
	});

	it("is plain `Approved` when the opening event is not held", () => {
		const pipelineEvents = [resolved(2, "2026-11-23T14:02:10.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) })).toEqual({ state: "done", meta: "Approved", loop: null });
	});

	it("matches the plan file whatever form the event recorded it in", () => {
		const absolute = "/work/app/src/tools/score/plan.aide";
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z", absolute), resolved(2, "2026-11-23T14:00:30.000Z", absolute)];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) }).meta).toBe("Approved 30s");
	});

	it("ignores a gate on a file that is not a plan", () => {
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z", "src/tools/score/todo.aide"), resolved(2, "2026-11-23T14:00:30.000Z", "src/tools/score/todo.aide")];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) }).state).toBe("todo");
	});

	it("reads the root module's plan under `.aide/plan.aide`", () => {
		const root = ".aide/plan.aide";
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z", root), resolved(2, "2026-11-23T14:01:00.000Z", root)];
		expect(describeApproval({ ctx: makeRailContext({ module: ".", pipelineEvents }) }).meta).toBe("Approved 1m 00s");
	});

	it("is not started when the gate opened but was never resolved and the status does not list it", () => {
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) }).state).toBe("todo");
	});

	it("pairs a resolution with the opening of its own plan, not another module's", () => {
		const other = "src/other/plan.aide";
		const pipelineEvents = [opened(1, "2026-11-23T14:00:00.000Z", other), opened(2, "2026-11-23T14:05:00.000Z"), resolved(3, "2026-11-23T14:05:40.000Z")];
		expect(describeApproval({ ctx: makeRailContext({ pipelineEvents }) }).meta).toBe("Approved 40s");
	});
});
