import { describe, expect, it } from "vitest";
import buildHistory from "@/service/observer/status/buildHistory/index.js";
import type { ModuleNode, ObserverEvent, RunningWork, SessionSummary, Status, WaitingFile } from "@/types/index.js";
import type { SessionRoute, StreamState } from "@/observer/page/types/index.js";
import reduceStream from "@/observer/page/reduceStream/index.js";
import buildSessionModel from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");
const KEY = "app-abc123";
const ROUTE: SessionRoute = { kind: "session", token: "tok", projectKey: KEY, sessionId: "s1", tab: "tree", item: null };

function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; seq: number; ts?: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId: "s1", pid: 1, ...fields } as ObserverEvent;
}

function summary({ sessionId, startedAt, liveness }: Pick<SessionSummary, "sessionId" | "startedAt" | "liveness">): SessionSummary {
	return { sessionId, startedAt, lastEventAt: startedAt, eventCount: 2, pid: 1, liveness, reported: null };
}

const planNode: ModuleNode = {
	folder: "src/a",
	parent: ".",
	files: [
		{
			kind: "plan",
			file: "src/a/plan.aide",
			folder: "src/a",
			read: { state: "present", status: "proposed", awaitingApproval: true, progress: { done: 0, total: 2, open: 2 }, steps: { done: 0, total: 2 } },
		},
	],
};

const waitingPlan: WaitingFile = {
	file: "src/a/plan.aide",
	folder: "src/a",
	kind: "plan",
	gate: "approve plan",
	sessionId: "s1",
	seq: 3,
	since: "2026-01-01T09:55:00.000Z",
};

const buildRun: RunningWork = {
	sessionId: "s1",
	phase: "build",
	agent: "aide-implementor",
	module: "src/a",
	startedAt: "2026-01-01T09:50:00.000Z",
	elapsedMs: 600_000,
	buildStep: { reached: 2, total: 5 },
};

function statusOf(overrides: Partial<Status> = {}): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: NOW.toISOString(),
		tree: [planNode],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions: [summary({ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() })],
		running: [],
		waiting: [waitingPlan],
		surfaced: waitingPlan,
		rails: [],
		history: [],
		board: { state: "unavailable", reason: "no-brain-path", detail: "", hint: "" },
		problems: [],
		...overrides,
	};
}

function stateOf(overrides: Partial<StreamState> = {}): StreamState {
	return { connection: "live", held: [], views: {}, listings: {}, projects: null, ...overrides };
}

const readyView = (status: Status): StreamState["views"] => ({ [KEY]: { state: "ready", projectKey: KEY, status } });

const events = [
	event({ kind: "session_started", seq: 1, kanbanTag: "app" }),
	event({ kind: "file_written", seq: 2, path: "C:\\work\\app\\.aide\\session.aide", action: "updated", ts: "2026-01-01T09:20:00.000Z" }),
	event({ kind: "gate_waiting", seq: 3, gate: "approve plan", file: "src/a/plan.aide", ts: "2026-01-01T09:55:00.000Z" }),
];

function modelOf(state: StreamState, { focus = "s1", stepText = null as string | null } = {}) {
	return buildSessionModel({ state, route: ROUTE, focus, now: NOW, ui: { stepText } });
}

describe("buildSessionModel", () => {
	it("derives the waiting view of a ready project", () => {
		const model = modelOf(stateOf({ held: [{ projectKey: KEY, sessionId: "s1", events }], views: readyView(statusOf({ history: buildHistory({ events }) })) }));

		expect(model.card.kind).toBe("wait");
		expect(model.waiting).toEqual({ file: "plan.aide", module: "src/a", since: "5m", path: "src/a/plan.aide" });
		expect(model.surfaced).toEqual(waitingPlan);
		expect(model.title).toBe("Waiting on you — app — AIDE Pipeline Viewer");
		expect(model.header).toMatchObject({ homeHref: "/?token=tok", project: "app", rootPath: "/work/app", kanbanTag: "app", switcher: [] });
		expect(model.header.sessionStart).toMatch(/^\d\d:\d\d$/);
		expect(model.conn).toBe("live");
		expect(model.notInstalled).toBeNull();
		expect(model.reconnecting).toBe(false);
		expect(model.board).toMatchObject({ kind: "unavailable", tone: "calm" });
		expect(model.plans).toHaveLength(1);
		expect(model.tree).toMatchObject({ kind: "tree", counts: { modules: 1 } });
		expect(model.tabs.map((tab) => tab.count)).toEqual([null, "1", null, "1", null]);
		expect(model.history.total).toBe(3);
		expect(model.history.rows.map((row) => row.kind)).toEqual(["start", "wait"]);
		expect(model.history.rows[0]?.files[0]?.label).toBe("Wrote 1 file");
	});

	it("shows the running Build with its step words once loaded", () => {
		const status = statusOf({ waiting: [], surfaced: null, running: [buildRun] });
		const model = modelOf(stateOf({ held: [{ projectKey: KEY, sessionId: "s1", events }], views: readyView(status) }), { stepText: "Wire the tabs" });

		expect(model.card).toMatchObject({ kind: "run", title: "Build", sub: "step 2 of 5", steps: { total: 5, done: 1, running: 1, text: "Wire the tabs" } });
		expect(model.waiting).toBeNull();
		expect(model.title).toBe("app — AIDE Pipeline Viewer");
		expect(model.tree).toMatchObject({ kind: "tree" });
	});

	it("is idle once events exist and nothing runs", () => {
		const status = statusOf({ waiting: [], surfaced: null });
		const model = modelOf(stateOf({ held: [{ projectKey: KEY, sessionId: "s1", events }], views: readyView(status) }));
		expect(model.card.kind).toBe("idle");
		expect(model.waiting).toBeNull();
	});

	it("is empty for a session with no activity beyond its start", () => {
		const only = [events[0]!];
		const status = statusOf({ waiting: [], surfaced: null });
		const model = modelOf(stateOf({ held: [{ projectKey: KEY, sessionId: "s1", events: only }], views: readyView(status) }));
		expect(model.card.kind).toBe("empty");
		expect(model.phases.every((cell) => cell.state === "todo")).toBe(true);
	});

	it("flags a ready project whose tree holds no AIDE file", () => {
		const model = modelOf(stateOf({ views: readyView(statusOf({ tree: [], waiting: [], surfaced: null })) }));
		expect(model.notInstalled).toEqual({ projectRoot: "/work/app" });
	});

	it("gives a project with no root held-event models and calm unavailable tree, plans and board", () => {
		const model = modelOf(
			stateOf({
				held: [{ projectKey: KEY, sessionId: "s1", events }],
				views: { [KEY]: { state: "no-project-root", projectKey: KEY, detail: "nobody reported a root" } },
				listings: {
					[KEY]: [{ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", metadata: null, eventCount: 3, lastEventAt: "2026-01-01T09:55:00.000Z", liveness: makeLiveness({ state: "ended" }) }],
				},
			}),
		);

		expect(model.status).toBeNull();
		expect(model.tree).toEqual({ kind: "unavailable" });
		expect(model.plans).toBeNull();
		expect(model.board).toMatchObject({ kind: "unavailable", tone: "calm", heading: "Board unavailable" });
		expect(model.tabs.map((tab) => tab.count)).toEqual([null, null, null, "1", null]);
		expect(model.header).toMatchObject({ project: "app", rootPath: null, kanbanTag: "app" });
		expect(model.waiting).toBeNull();
		expect(model.notInstalled).toBeNull();
		expect(model.phases.every((cell) => cell.state === "todo")).toBe(true);
		expect(model.card.kind).toBe("idle");
		expect(model.sessions.map((session) => session.liveness.state)).toEqual(["ended"]);
		expect(model.conn).toBe("idle");
		expect(model.history.total).toBe(3);
		expect(model.record).toMatchObject({ kind: "missing" });
	});

	it("is empty and pending before the first status", () => {
		const model = modelOf(stateOf({ connection: "connecting" }));

		expect(model.board).toMatchObject({ kind: "unavailable", tone: "calm" });
		expect(model.card.kind).toBe("empty");
		expect(model.sessions).toEqual([]);
		expect(model.conn).toBe("idle");
		expect(model.header.sessionStart).toBeNull();
		expect(model.notInstalled).toBeNull();
		expect(model.notFound).toBe(false);
	});

	it("keeps everything on screen while reconnecting, with the pill and the last update", () => {
		const model = modelOf(stateOf({ connection: "reconnecting", held: [{ projectKey: KEY, sessionId: "s1", events }], views: readyView(statusOf()) }));

		expect(model.reconnecting).toBe(true);
		expect(model.conn).toBe("recon");
		expect(model.lastUpdate).toMatch(/^\d\d:\d\d:\d\d$/);
		expect(model.card.kind).toBe("wait");
		expect(model.history.total).toBe(3);
	});

	it("reports a session the observer has no recording of, with no pill", () => {
		const model = modelOf(stateOf({ connection: "not-found" }));
		expect(model.notFound).toBe(true);
		expect(model.conn).toBeNull();
	});

	it("marks the board offline in the tab when the brain cannot be read, leaving the rest alone", () => {
		const status = statusOf({ waiting: [], surfaced: null, board: { state: "unavailable", reason: "board-read-failed", detail: "EACCES", hint: "" } });
		const model = modelOf(stateOf({ views: readyView(status) }));

		expect(model.board).toMatchObject({ kind: "unavailable", tone: "err" });
		expect(model.tabs[2]).toMatchObject({ label: "Board", count: "offline", tone: "danger" });
		expect(model.tree).toMatchObject({ kind: "tree" });
	});

	describe("two live sessions", () => {
		const status = statusOf({
			waiting: [],
			surfaced: null,
			running: [{ ...buildRun, sessionId: "s2", phase: "research", module: "src/b", buildStep: undefined }],
			sessions: [
				summary({ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() }),
				summary({ sessionId: "s2", startedAt: "2026-01-01T09:30:00.000Z", liveness: makeLiveness({ minutesQuiet: 20 }) }),
			],
		});
		const held = [
			{ projectKey: KEY, sessionId: "s1", events },
			{ projectKey: KEY, sessionId: "s2", events: [event({ kind: "session_started", seq: 1, sessionId: "s2", ts: "2026-01-01T09:30:00.000Z" })] },
		];

		it("offers the switcher, following the link's session by default", () => {
			const model = modelOf(stateOf({ held, views: readyView(status) }));
			expect(model.focus).toBe("s1");
			expect(model.header.switcher.map((option) => [option.id, option.now, option.pressed])).toEqual([
				["s1", "No phase running", true],
				["s2", "Research · src/b", false],
			]);
			expect(model.history.sessions).toEqual([]);
			expect(model.history.rows.every((row) => row.sessionId === "s1")).toBe(true);
		});

		it("follows any listed session picked, even one that has ended, for the card and the history", () => {
		const endedStatus = statusOf({
			waiting: [],
			surfaced: null,
			sessions: [
				summary({ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() }),
				summary({ sessionId: "s2", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
			],
		});
		const model = modelOf(stateOf({ held, views: readyView(endedStatus) }), { focus: "s2" });
		expect(model.focus).toBe("s2");
		expect(model.header.switcher).toEqual([]);
		expect(model.history.rows.every((row) => row.sessionId === "s2")).toBe(true);
	});

	it("follows the session the switcher picked, for the card and the pill, without changing the route", () => {
			const model = modelOf(stateOf({ held, views: readyView(status) }), { focus: "s2" });
			expect(model.focus).toBe("s2");
			expect(model.card).toMatchObject({ kind: "run", title: "Research" });
			expect(model.conn).toBe("idle");
			expect(model.header.switcher.find((option) => option.pressed)?.id).toBe("s2");
		});
	});

	describe("deleting an ended session", () => {
		const ended = summary({ sessionId: "s2", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) });
		const live = summary({ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() });
		const held = [
			{ projectKey: KEY, sessionId: "s1", events },
			{ projectKey: KEY, sessionId: "s2", events: [event({ kind: "session_started", seq: 1, sessionId: "s2", ts: "2026-01-01T08:00:00.000Z" })] },
		];

		it("leaves the sessions list and the history once the stream's status and snapshot frames arrive", () => {
			const before = stateOf({ held, views: readyView(statusOf({ waiting: [], surfaced: null, sessions: [live, ended] })) });
			expect(modelOf(before).sessions.map((session) => session.sessionId)).toEqual(["s1", "s2"]);

			const view = readyView(statusOf({ waiting: [], surfaced: null, sessions: [live] }))[KEY]!;
			const afterStatus = reduceStream(before, { name: "status", data: { projectKey: KEY, view } });
			const after = reduceStream(afterStatus, { name: "snapshot", data: { sessions: [held[0]!] } });
			const model = modelOf(after);

			expect(model.sessions.map((session) => session.sessionId)).toEqual(["s1"]);
			expect(model.tabs.find((tab) => tab.id === "sessions")?.count).toBe("1");
			expect(model.events.every((held) => held.sessionId === "s1")).toBe(true);
			expect(model.history.rows.every((row) => row.sessionId === "s1")).toBe(true);
		});

		it("leaves the list of a project with no root through the sessions frame", () => {
			const listing = (sessionId: string) => ({ sessionId, startedAt: "2026-01-01T08:00:00.000Z", metadata: null, eventCount: 1, lastEventAt: null, liveness: makeLiveness({ state: "ended" }) });
			const before = stateOf({ views: { [KEY]: { state: "no-project-root", projectKey: KEY, detail: "d" } }, listings: { [KEY]: [listing("s1"), listing("s2")] } });
			const after = reduceStream(before, { name: "sessions", data: { projectKey: KEY, sessions: [listing("s1")] } });

			expect(modelOf(before).sessions).toHaveLength(2);
			expect(modelOf(after).sessions.map((session) => session.sessionId)).toEqual(["s1"]);
		});
	});

	it("ignores events held for another project", () => {
		const model = modelOf(stateOf({ held: [{ projectKey: "other-111111", sessionId: "x", events: [event({ kind: "prompt", seq: 1, text: "hi", sessionId: "x" })] }] }));
		expect(model.events).toEqual([]);
	});
});
