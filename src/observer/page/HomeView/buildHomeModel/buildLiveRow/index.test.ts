import { describe, expect, it } from "vitest";
import type { RunningWork, WaitingFile } from "@/types/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import buildLiveRow from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number, seconds = 0): string => new Date(2026, 10, 23, hours, minutes, seconds).toISOString();
const PROJECT = { projectKey: "app-abc123", name: "app" };

function session(overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return { sessionId: "s1", startedAt: at(14, 0), lastEventAt: at(14, 30), eventCount: 4, liveness: makeLiveness(), task: null, label: null, ...overrides };
}

function waiting(overrides: Partial<WaitingFile> = {}): WaitingFile {
	return { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: at(14, 28), ...overrides };
}

function build(args: { status?: ReturnType<typeof makeStatus> | null; session?: SessionRowModel } = {}) {
	return buildLiveRow({ token: "tok", project: PROJECT, session: args.session ?? session(), status: args.status === undefined ? makeStatus() : args.status, now: NOW });
}

describe("buildLiveRow", () => {
	it("keys the row by project and session and links to the session view", () => {
		const row = build();
		expect(row.key).toBe("app-abc123:s1");
		expect(row.project).toBe("app");
		expect(row.href).toBe("/p/app-abc123/s/s1?token=tok");
	});

	it("reads `No phase running` with no module, agent or elapsed when the status holds nothing for the session", () => {
		const row = build();
		expect(row.phase).toBe("No phase running");
		expect(row.module).toBeNull();
		expect(row.agent).toBeNull();
		expect(row.elapsed).toBeNull();
	});

	it("carries the rail's pipeline and reads `Working outside the pipeline` for a rail that says so", () => {
		const rail = (outside: boolean) => makeStatus({ rails: [{ sessionId: "s1", pipeline: "feature-x", pipelineState: "running", outside, stages: [] }] });
		expect(build({ status: rail(false) })).toMatchObject({ pipeline: "feature-x", outside: false, phase: "No phase running" });
		expect(build({ status: rail(true) })).toMatchObject({ pipeline: "feature-x", outside: true, phase: "Working outside the pipeline" });
	});

	it("carries the pipeline beside a running phase, and none for another session's rail", () => {
		const status = makeStatus({ running: [makeWork({ phase: "plan" })], rails: [{ sessionId: "s1", pipeline: "feature-x", pipelineState: "running", outside: false, stages: [] }, { sessionId: "s2", pipeline: "other", pipelineState: "running", outside: false, stages: [] }] });
		expect(build({ status })).toMatchObject({ pipeline: "feature-x", phase: "Plan" });
		expect(build({ status: makeStatus({ rails: [{ sessionId: "s2", pipeline: "other", pipelineState: "running", outside: false, stages: [] }] }) }).pipeline).toBeNull();
	});

	it("reads `No phase running` when the project has no status yet", () => {
		expect(build({ status: null }).phase).toBe("No phase running");
	});

	it("shows the running phase with its agent, module and how long it has run", () => {
		const status = makeStatus({ running: [makeWork({ phase: "qa", agent: "aide-qa", module: "src/crawl/robots", startedAt: at(14, 32) })] });
		const row = build({ status });
		expect(row.phase).toBe("QA");
		expect(row.module).toBe("src/crawl/robots");
		expect(row.agent).toBe("aide-qa");
		expect(row.elapsed).toBe("2m 00s");
	});

	it("adds the Build step to the phase word", () => {
		const status = makeStatus({ running: [makeWork({ phase: "build", buildStep: { reached: 4, total: 9 } })] });
		expect(build({ status }).phase).toBe("Build · step 4 of 9");
	});

	it("leaves the step off a phase other than Build", () => {
		const status = makeStatus({ running: [makeWork({ phase: "plan", buildStep: { reached: 4, total: 9 } })] });
		expect(build({ status }).phase).toBe("Plan");
	});

	it("reads the project name for a running root module", () => {
		const status = makeStatus({ running: [makeWork({ module: "." })] });
		expect(build({ status }).module).toBe("app");
	});

	it("takes the newest running phase of the session and ignores other sessions", () => {
		const older: RunningWork = makeWork({ phase: "spec", startedAt: at(14, 10) });
		const newer: RunningWork = makeWork({ phase: "plan", startedAt: at(14, 20) });
		const other: RunningWork = makeWork({ sessionId: "s2", phase: "fix", startedAt: at(14, 33) });
		expect(build({ status: makeStatus({ running: [older, other, newer] }) }).phase).toBe("Plan");
	});

	it("lets an open gate win over a running phase", () => {
		const status = makeStatus({ waiting: [waiting()], running: [makeWork()] });
		const row = build({ status });
		expect(row.phase).toBeNull();
		expect(row.module).toBe("src/a");
		expect(row.agent).toBeNull();
		expect(row.elapsed).toBe("6m");
	});

	it("ignores a gate open in another session", () => {
		const status = makeStatus({ waiting: [waiting({ sessionId: "s2" })] });
		expect(build({ status }).phase).toBe("No phase running");
	});

	it.each([
		["working", 1, { word: "Working", className: "run", icon: "run" }],
		["waiting", 1, { word: "Waiting on you", className: "wait", icon: "wait" }],
		["working", 20, { word: "Quiet 20 min · maybe stuck", className: "neutral", icon: "idle" }],
		["ended", 90, { word: "Ended", className: "neutral", icon: "power" }],
	] as const)("takes the badge from the session's liveness (%s, %i min quiet)", (state, minutesQuiet, badge) => {
		const liveness = makeLiveness({ state, minutesQuiet, now: NOW });
		expect(build({ session: session({ liveness }) }).badge).toEqual(badge);
	});

	it("counts the quiet minutes forward with the clock while the status shows a running phase", () => {
		const liveness = makeLiveness({ minutesQuiet: 10, now: NOW });
		const status = makeStatus({ running: [makeWork({ phase: "qa" })] });
		const later = new Date(NOW.getTime() + 10 * 60 * 1000);
		expect(buildLiveRow({ token: "tok", project: PROJECT, session: session({ liveness }), status, now: NOW }).badge.word).toBe("Working");
		const stuck = buildLiveRow({ token: "tok", project: PROJECT, session: session({ liveness }), status, now: later });
		expect(stuck.badge.word).toBe("Quiet 20 min · maybe stuck");
		expect(stuck.phase).toBe("QA");
	});

	it("prints the session start as a clock time", () => {
		expect(build().start).toBe("14:00");
	});
});
