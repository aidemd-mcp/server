import { describe, expect, it } from "vitest";
import type { ProjectListing, ProjectView, SessionListing } from "@/observer/types/index.js";
import type { ObserverEvent, RunningWork, SessionSummary, Status, WaitingFile } from "@/types/index.js";
import type { StreamState } from "@/observer/page/types/index.js";
import buildHomeModel from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number, seconds = 0): string => new Date(2026, 10, 23, hours, minutes, seconds).toISOString();

function listing(overrides: Partial<SessionListing> & { sessionId: string }): SessionListing {
	return { startedAt: at(9, 0), metadata: null, eventCount: 3, lastEventAt: at(9, 10), live: false, ...overrides };
}

function project(overrides: Partial<ProjectListing> & { projectKey: string }): ProjectListing {
	return { projectRoot: null, sessions: [], lastEventAt: null, ...overrides };
}

function summary(overrides: Partial<SessionSummary> & { sessionId: string }): SessionSummary {
	return { startedAt: at(9, 0), lastEventAt: at(9, 10), eventCount: 3, pid: 1, liveness: "ended", reported: null, ...overrides };
}

function waitingFile(overrides: Partial<WaitingFile> = {}): WaitingFile {
	return { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: at(14, 28), ...overrides };
}

function running(overrides: Partial<RunningWork> & { sessionId: string }): RunningWork {
	return { phase: "qa", agent: "aide-qa", module: "src/crawl/robots", startedAt: at(14, 32), elapsedMs: 0, ...overrides };
}

function ready({
	projectKey,
	root,
	sessions = [],
	waiting = [],
	working = [],
}: {
	projectKey: string;
	root: string;
	sessions?: SessionSummary[];
	waiting?: WaitingFile[];
	working?: RunningWork[];
}): ProjectView {
	const status: Status = {
		projectRoot: root,
		generatedAt: at(14, 34),
		tree: [],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions,
		running: working,
		waiting,
		surfaced: waiting[0] ?? null,
		rail: null,
		history: [],
		board: { state: "unavailable", reason: "no-brain-path", detail: "", hint: "" },
		problems: [],
	};
	return { state: "ready", projectKey, status };
}

function streamState(overrides: Partial<StreamState>): StreamState {
	return { connection: "live", held: [], views: {}, listings: {}, projects: [], ...overrides };
}

function build(overrides: Partial<StreamState>) {
	return buildHomeModel({ state: streamState(overrides), now: NOW, token: "tok" });
}

describe("buildHomeModel", () => {
	it("shows nothing and no empty notice before the project list arrives", () => {
		const model = build({ projects: null, connection: "connecting" });
		expect(model).toMatchObject({ empty: false, waits: [], live: [], projects: [], conn: "idle", subtitle: "On this machine (127.0.0.1)" });
	});

	it("is empty with a loaded, empty project list", () => {
		expect(build({ projects: [] })).toMatchObject({ empty: true, subtitle: "On this machine (127.0.0.1)", filterable: false });
	});

	it("counts projects and live sessions in the subtitle", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" }), project({ projectKey: "beta-222222" })],
			views: {
				"alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", sessions: [summary({ sessionId: "a1", liveness: "live" }), summary({ sessionId: "a2", liveness: "idle" })] }),
				"beta-222222": ready({ projectKey: "beta-222222", root: "/work/beta", sessions: [summary({ sessionId: "b1" })] }),
			},
		});
		expect(model.subtitle).toBe("2 projects · 2 live sessions · on this machine (127.0.0.1)");
	});

	it("uses singular count words for one project and one live session", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" })],
			views: { "alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", sessions: [summary({ sessionId: "a1", liveness: "live" })] }) },
		});
		expect(model.subtitle).toBe("1 project · 1 live session · on this machine (127.0.0.1)");
	});

	it("keeps the plural for zero live sessions", () => {
		const model = build({ projects: [project({ projectKey: "alpha-111111" })] });
		expect(model.subtitle).toBe("1 project · 0 live sessions · on this machine (127.0.0.1)");
	});

	it("draws one wait card per open waiting file across projects, newest first, with the handoff's span and clock", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" }), project({ projectKey: "beta-222222" }), project({ projectKey: "gamma-333333" })],
			views: {
				"alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", waiting: [waitingFile({ since: at(14, 0) })] }),
				"beta-222222": ready({
					projectKey: "beta-222222",
					root: "/work/beta",
					waiting: [
						waitingFile({ file: "src/b/todo.aide", folder: "src/b", kind: "todo", sessionId: "s9", seq: 5, since: at(14, 28) }),
						waitingFile({ file: "plan.aide", folder: ".", sessionId: "s8", seq: 4, since: at(14, 10) }),
					],
				}),
				"gamma-333333": ready({ projectKey: "gamma-333333", root: "/work/gamma" }),
			},
		});

		expect(model.waits.map((card) => [card.project, card.file, card.module, card.since, card.at])).toEqual([
			["beta", "todo.aide", "src/b", "6m", "14:28"],
			["beta", "plan.aide", "beta", "24m", "14:10"],
			["alpha", "plan.aide", "src/a", "34m", "14:00"],
		]);
		expect(model.waits[0].href).toBe("/p/beta-222222/s/s9?token=tok&item=file%3Asrc%2Fb%2Ftodo.aide");
	});

	it("lists live and idle sessions of every project, newest first, and leaves ended ones out", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" }), project({ projectKey: "beta-222222" })],
			views: {
				"alpha-111111": ready({
					projectKey: "alpha-111111",
					root: "/work/alpha",
					sessions: [
						summary({ sessionId: "a-live", startedAt: at(9, 0), liveness: "live" }),
						summary({ sessionId: "a-ended", startedAt: at(7, 0), liveness: "ended" }),
					],
				}),
				"beta-222222": ready({ projectKey: "beta-222222", root: "/work/beta", sessions: [summary({ sessionId: "b-idle", startedAt: at(9, 30), liveness: "idle" })] }),
			},
		});

		expect(model.live.map((row) => [row.project, row.start, row.href])).toEqual([
			["beta", "09:30", "/p/beta-222222/s/b-idle?token=tok"],
			["alpha", "09:00", "/p/alpha-111111/s/a-live?token=tok"],
		]);
	});

	it("badges a live row waiting on you, with the module and the span it has waited, and no agent", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" })],
			views: { "alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", sessions: [summary({ sessionId: "s1", liveness: "live" })], waiting: [waitingFile({ sessionId: "s1" })] }) },
		});
		expect(model.live[0]).toMatchObject({ badge: { word: "Waiting on you", className: "wait", icon: "wait" }, module: "src/a", agent: null, elapsed: "6m" });
	});

	it("badges a live row with the phase it runs, the Build step, its module, agent and elapsed time", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" })],
			views: {
				"alpha-111111": ready({
					projectKey: "alpha-111111",
					root: "/work/alpha",
					sessions: [summary({ sessionId: "s1", liveness: "live" }), summary({ sessionId: "s2", liveness: "live", startedAt: at(9, 5) })],
					working: [
						running({ sessionId: "s1", phase: "build", agent: "aide-implementor", module: "src/tools/score", startedAt: at(14, 26, 5), buildStep: { reached: 4, total: 9 } }),
						running({ sessionId: "s2", phase: "qa", agent: "aide-qa", module: "src/crawl/robots", startedAt: at(14, 31, 57) }),
					],
				}),
			},
		});
		expect(model.live.map((row) => [row.badge.word, row.badge.className, row.module, row.agent, row.elapsed])).toEqual([
			["QA", "run", "src/crawl/robots", "aide-qa", "2m 03s"],
			["Build · step 4 of 9", "run", "src/tools/score", "aide-implementor", "7m 55s"],
		]);
	});

	it("badges a live row with no running work as No phase running, and one whose status is not ready the same", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" }), project({ projectKey: "orphan-abc123", sessions: [listing({ sessionId: "o1", live: true })] })],
			views: {
				"alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", sessions: [summary({ sessionId: "s1", liveness: "live" })] }),
				"orphan-abc123": { state: "no-project-root", projectKey: "orphan-abc123", detail: "No session reported a root." },
			},
		});
		expect(model.live).toHaveLength(2);
		for (const row of model.live) {
			expect(row).toMatchObject({ badge: { word: "No phase running", className: "neutral" }, module: null, agent: null, elapsed: null });
		}
	});

	it("reads the pill as recon while reconnecting, live with a live session, else idle", () => {
		const projects = [project({ projectKey: "alpha-111111" })];
		const withSession = (liveness: SessionSummary["liveness"]) => ({
			"alpha-111111": ready({ projectKey: "alpha-111111", root: "/work/alpha", sessions: [summary({ sessionId: "s1", liveness })] }),
		});
		expect(build({ projects, views: withSession("live") }).conn).toBe("live");
		expect(build({ projects, views: withSession("idle") }).conn).toBe("idle");
		expect(build({ projects, views: withSession("ended") }).conn).toBe("idle");
		expect(build({ projects, views: withSession("live"), connection: "reconnecting" }).conn).toBe("recon");
	});

	it.each([
		[6, false],
		[7, true],
	])("offers the project filter only past 6 projects (%i projects: %s)", (count, filterable) => {
		const projects = Array.from({ length: count }, (_, index) => project({ projectKey: `p${index}-abcdef` }));
		expect(build({ projects }).filterable).toBe(filterable);
	});

	it("sorts projects by their latest event, a project with no event last", () => {
		const model = build({
			projects: [
				project({ projectKey: "quiet-111111", projectRoot: "/work/quiet", lastEventAt: at(8, 0) }),
				project({ projectKey: "empty-222222", projectRoot: "/work/empty" }),
				project({ projectKey: "busy-333333", projectRoot: "/work/busy", lastEventAt: at(14, 30) }),
			],
		});
		expect(model.projects.map((entry) => [entry.name, entry.lastActivity])).toEqual([
			["busy", "4m ago"],
			["quiet", "6h ago"],
			["empty", null],
		]);
	});

	it("marks a project waiting, counts its live sessions and links to its newest session", () => {
		const model = build({
			projects: [project({ projectKey: "alpha-111111" })],
			views: {
				"alpha-111111": ready({
					projectKey: "alpha-111111",
					root: "/work/alpha",
					sessions: [summary({ sessionId: "old", startedAt: at(8, 0) }), summary({ sessionId: "new", startedAt: at(9, 0), liveness: "live" })],
					waiting: [waitingFile({ sessionId: "new" })],
				}),
			},
		});
		const [entry] = model.projects;
		expect(entry).toMatchObject({ waiting: true, liveCount: 1, openHref: "/p/alpha-111111/s/new?token=tok" });
		expect(entry.rows.map((row) => row.sessionId)).toEqual(["new", "old"]);
	});

	it("lists a project with no reported root under its key, with the reported kanban tag and no open link when it has no session", () => {
		const model = build({
			projects: [
				project({ projectKey: "orphan-abc123", sessions: [listing({ sessionId: "s1", live: true, metadata: { kanbanTag: "orphan" } })], lastEventAt: at(9, 10) }),
				project({ projectKey: "bare-def456" }),
			],
			views: { "orphan-abc123": { state: "no-project-root", projectKey: "orphan-abc123", detail: "No session reported a root." } },
		});

		const orphan = model.projects.find((entry) => entry.name === "orphan");
		expect(orphan).toMatchObject({ root: null, kanbanTag: "orphan", liveCount: 1, waiting: false });
		expect(orphan?.rows.map((row) => [row.sessionId, row.liveness])).toEqual([["s1", "live"]]);
		expect(model.projects.find((entry) => entry.name === "bare")?.openHref).toBeNull();
	});

	it("prefers the sessions frame's listing over the project's own, and the task of the newest task event", () => {
		const held = [
			{
				projectKey: "alpha-111111",
				sessionId: "s1",
				events: [{ v: 1, ts: at(9, 5), sessionId: "s1", pid: 1, seq: 2, kind: "task", slug: "fix-login", title: "Fix login" }] as ObserverEvent[],
			},
		];
		const model = build({
			projects: [project({ projectKey: "alpha-111111", projectRoot: "/work/alpha", sessions: [listing({ sessionId: "old" })] })],
			listings: { "alpha-111111": [listing({ sessionId: "s1" })] },
			held,
		});

		expect(model.projects[0].rows.map((row) => [row.sessionId, row.task])).toEqual([["s1", "Fix login"]]);
	});
});
