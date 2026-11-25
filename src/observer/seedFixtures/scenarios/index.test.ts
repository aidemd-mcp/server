import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import read from "@/service/observer/event/read/index.js";
import { inputSchema } from "@/service/observer/event/shared/schema/index.js";
import rebuildStatus from "@/observer/rebuildStatus/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import seedFixtures from "@/observer/seedFixtures/index.js";
import type { FixtureSet, SeededFixtures } from "@/observer/seedFixtures/types/index.js";
import scenarios from "./index.js";

/** Seeding all ten scenarios (about a hundred files and a dozen child processes) takes a few seconds. */
const SEED_TIMEOUT_MS = 120_000;

const EXPECTED_LABELS = [
	"s-not-installed",
	"s-no-events",
	"s-building",
	"s-waiting",
	"s-idle",
	"s-two-live",
	"s-board-error",
	"s-large",
	"s-qa-fix",
	"s-no-folder",
];

const EXPECTED_IDS = [
	"notInstalled",
	"noEvents",
	"building",
	"waiting",
	"idle",
	"twoSessions",
	"brainUnreachable",
	"large",
	"qaFixRound",
	"noRoot",
];

/** The catalog scenario with this id. */
function scenarioOf(id: string) {
	const found = scenarios({ set: "sessions" }).find((scenario) => scenario.id === id);
	if (!found) throw new Error(`No scenario ${id}`);
	return found;
}

/** The intent specs a project's files hold: the root's `.aide/intent.aide` and every `<path>/.aide`. */
function countSpecs(files: Record<string, string>): number {
	return Object.keys(files).filter((path) => path === ".aide/intent.aide" || path.endsWith("/.aide")).length;
}

describe("scenarios catalog", () => {
	it("holds the ten scenarios, in the handoff's order, labelled with its state names and with unique ids", () => {
		const ids = scenarios({ set: "sessions" }).map((scenario) => scenario.id);

		expect(ids).toEqual(EXPECTED_IDS);
		expect(scenarios({ set: "sessions" }).map((scenario) => scenario.label)).toEqual(EXPECTED_LABELS);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("only holds events that parse as agent input, in time order, and starts every session with session_started", () => {
		for (const { id, project } of (["sessions", "home-many"] as const).flatMap((set) => scenarios({ set }))) {
			for (const session of project.sessions) {
				expect(session.events[0]?.kind, `${id} first event`).toBe("session_started");

				let previous = Number.POSITIVE_INFINITY;
				for (const { offsetMin, ...input } of session.events) {
					expect(inputSchema.safeParse(input).success, `${id} ${input.kind}`).toBe(true);
					expect(offsetMin, `${id} ${input.kind} offset`).toBeGreaterThanOrEqual(0);
					expect(offsetMin, `${id} ${input.kind} order`).toBeLessThanOrEqual(previous);
					previous = offsetMin;
				}
			}
		}
	});

	it("gives the large scenario the handoff's 47 modules and its column totals, and the others its 14 modules", () => {
		const columnCounts = (id: string) => {
			const { board } = scenarioOf(id).project;
			const tasks = board !== null && "tasks" in board ? board.tasks : [];
			expect(new Set(tasks.map((task) => `${task.column}/${task.slug}`)).size, `${id} unique tasks`).toBe(tasks.length);
			return Object.fromEntries(
				["backlog", "todo", "in-progress", "in-review", "done"].map((column) => [column, tasks.filter((task) => task.column === column).length]),
			);
		};

		expect(countSpecs(scenarioOf("large").project.files)).toBe(47);
		expect(columnCounts("large")).toEqual({ backlog: 41, todo: 22, "in-progress": 2, "in-review": 1, done: 128 });
		expect(countSpecs(scenarioOf("building").project.files)).toBe(14);
		expect(columnCounts("building")).toEqual({ backlog: 4, todo: 3, "in-progress": 2, "in-review": 1, done: 14 });
		expect(countSpecs(scenarioOf("noEvents").project.files)).toBe(1);
	});

	it("stamps every task and makes the handoff's five Done tasks the newest", () => {
		const { board } = scenarioOf("building").project;
		const tasks = board !== null && "tasks" in board ? board.tasks : [];
		const done = tasks.filter((task) => task.column === "done").sort((a, b) => (a.updated! < b.updated! ? 1 : -1));

		expect(tasks.every((task) => task.updated !== undefined)).toBe(true);
		expect(done.slice(0, 5).map((task) => task.slug)).toEqual([
			"plan-substep-numbers",
			"event-brain-folder",
			"qa-open-count",
			"release-event",
			"cli-help-tidy",
		]);
	});

	it("cuts each scenario's history at its handoff state", () => {
		const kinds = (id: string, session = 0) => scenarioOf(id).project.sessions[session]!.events.map((event) => event.kind);
		const last = (id: string, session = 0) => scenarioOf(id).project.sessions[session]!.events.at(-1)!;

		expect(kinds("noEvents")).toEqual(["session_started", "prompt"]);
		expect(last("building")).toMatchObject({ kind: "phase_started", phase: "build" });
		expect(kinds("building").at(-2)).toBe("commit");
		expect(last("idle")).toMatchObject({ kind: "release", version: "v0.9.2" });
		expect(last("twoSessions")).toMatchObject({ kind: "phase_started", phase: "plan" });
		expect(last("twoSessions", 1)).toMatchObject({ kind: "phase_started", phase: "research", module: "src/tools/validate" });
		expect(last("qaFixRound")).toMatchObject({ kind: "phase_started", phase: "fix" });
		expect(kinds("qaFixRound").filter((kind) => kind === "qa_verdict")).toHaveLength(2);
		expect(last("noRoot")).toMatchObject({ kind: "phase_started", phase: "build" });
		expect(scenarioOf("building").project.sessions).toHaveLength(4);
	});

	it("ends the waiting scenario on the plan approval gate, with that plan proposed", () => {
		const { project } = scenarioOf("waiting");
		const events = project.sessions[0]!.events;

		expect(events.at(-1)).toMatchObject({ kind: "gate_waiting", file: "src/tools/score/plan.aide" });
		expect(project.files["src/tools/score/plan.aide"]).toMatch(/^---\nstatus: proposed\n/);
	});

	it("leaves the not-installed project without files and the no-root project without a reported root", () => {
		expect(scenarioOf("notInstalled").project).toMatchObject({ installed: false, files: {} });
		expect(scenarioOf("noRoot").project).toMatchObject({ reportRoot: false, board: null });
	});
});

describe("scenarios as the observer reads them", () => {
	let base: string;
	let seeded: SeededFixtures;
	let statuses: Map<string, Awaited<ReturnType<typeof rebuildStatus>>>;

	// Seeding spawns a child per ended session, so the catalog is seeded once and every test only reads it.
	beforeAll(async () => {
		base = await mkdtemp(join(tmpdir(), "aide-scenarios-"));
		vi.stubEnv("LOCALAPPDATA", join(base, "appdata"));
		vi.stubEnv("XDG_STATE_HOME", join(base, "appdata"));

		seeded = await seedFixtures({ appDataRoot: resolveRoot().root, workDir: join(base, "work"), now: Date.now(), set: "sessions" });

		const projects = await read();
		statuses = new Map();
		for (const scenario of seeded.scenarios) {
			const log = projects.find((project) => project.projectKey === scenario.projectKey);
			if (!log || log.projectRoot === null) continue;
			const sessions = log.sessions.map(({ sessionId, events }) => ({ projectKey: log.projectKey, sessionId, events }));
			statuses.set(scenario.id, await rebuildStatus({ projectKey: log.projectKey, projectRoot: log.projectRoot, sessions }));
		}
	}, SEED_TIMEOUT_MS);

	afterAll(async () => {
		vi.unstubAllEnvs();
		await rm(base, { recursive: true, force: true });
	});

	it("seeds one project per scenario, each with the sessions its scenario lists", () => {
		expect(seeded.scenarios.map((scenario) => scenario.id)).toEqual(EXPECTED_IDS);
		for (const scenario of seeded.scenarios) {
			expect(scenario.sessionIds, scenario.id).toHaveLength(scenarioOf(scenario.id).project.sessions.length);
		}
		expect(new Set(seeded.scenarios.map((scenario) => scenario.projectKey)).size).toBe(EXPECTED_IDS.length);
	});

	it("reads building as Build step 4 of 9 on src/tools/score, with nothing waiting", () => {
		const status = statuses.get("building")!;

		expect(status.running[0]).toMatchObject({ phase: "build", module: "src/tools/score", buildStep: { reached: 4, total: 9 } });
		expect(status.waiting).toEqual([]);
		expect(status.sessions.filter((session) => session.liveness.state === "working")).toHaveLength(1);
		expect(status.sessions.filter((session) => session.liveness.state === "ended")).toHaveLength(3);
		expect(status.board.state).toBe("available");
		expect(status.sessionRecord.state).toBe("present");
		expect(status.board).toMatchObject({ state: "available", kanbanTag: "aidemd" });
	});

	it("reads waiting as the plan approval being surfaced", () => {
		const status = statuses.get("waiting")!;

		expect(status.surfaced).toMatchObject({ file: "src/tools/score/plan.aide", kind: "plan" });
		expect(status.waiting).toHaveLength(1);
	});

	it("reads idle as a working session quiet for over thirty minutes with no work running", () => {
		const status = statuses.get("idle")!;

		expect(status.sessions.some((session) => session.liveness.state === "working" && session.liveness.maybeStuck)).toBe(true);
		expect(status.running).toEqual([]);
		expect(status.waiting).toEqual([]);
	});

	it("reads twoSessions as two live sessions, the newest running Research on src/tools/validate", () => {
		const status = statuses.get("twoSessions")!;

		expect(status.sessions.filter((session) => session.liveness.state === "working")).toHaveLength(2);
		expect(status.running[0]).toMatchObject({ phase: "research", module: "src/tools/validate" });
		expect(status.running.map((work) => work.module).sort()).toEqual(["src/tools/score", "src/tools/validate"]);
	});

	it("shows the four states across the sessions: working, waiting, quiet and ended", () => {
		const states = (id: string) => statuses.get(id)!.sessions.map((session) => session.liveness);

		expect(states("building").filter((liveness) => liveness.state === "working" && !liveness.maybeStuck)).toHaveLength(1);
		expect(states("waiting").filter((liveness) => liveness.state === "waiting")).toHaveLength(1);
		expect(states("idle").filter((liveness) => liveness.state === "working" && liveness.maybeStuck)).toHaveLength(1);
		expect(states("building").filter((liveness) => liveness.state === "ended" && liveness.endedBy === "user")).toHaveLength(3);
		expect(states("noEvents")).toMatchObject([{ state: "working", maybeStuck: false }]);
	});

	it("reads qaFixRound with a skipped Research cell on the rail of its running pipeline", () => {
		const [rail] = statuses.get("qaFixRound")!.rails;

		expect(rail.stages.find((stage) => stage.phase === "research")).toMatchObject({ state: "skipped", reason: "routing skipped research" });
	});

	it("reads brainUnreachable with a board that cannot be located", () => {
		const status = statuses.get("brainUnreachable")!;

		expect(status.board).toMatchObject({ state: "unavailable", reason: "brain-path-missing" });
	});

	it("reads qaFixRound as Fix round 2", () => {
		const status = statuses.get("qaFixRound")!;

		expect(status.running[0]).toMatchObject({ phase: "fix", qaFixRound: 2 });
		const todo = status.workFiles.find((file) => file.file === "src/tools/score/todo.aide");
		expect(todo?.read).toMatchObject({ state: "present", steps: { done: 3, total: 5 } });
	});

	it("reads notInstalled as a project with no AIDE files", () => {
		expect(statuses.get("notInstalled")!.tree).toEqual([]);
	});

	it("writes the session record the observer parses into its named sections", async () => {
		const status = statuses.get("building")!;
		if (status.sessionRecord.state !== "present") throw new Error("session record not present");

		const headings = status.sessionRecord.sections.map((section) => section.heading);
		expect(headings).toEqual([
			"Where this cycle stopped",
			"State summary",
			"Kanban",
			"Architectural intent",
			"Anti-regression invariants",
			"Open questions",
		]);
		const stopped = status.sessionRecord.sections.find((section) => section.heading === "Where this cycle stopped");
		expect(stopped?.subsections.map((sub) => sub.heading)).toEqual(["What the next agent must do"]);
		expect(stopped?.subsections[0]?.markdown.split("\n")).toHaveLength(4);
		const questions = status.sessionRecord.sections.find((section) => section.heading === "Open questions");
		expect(questions).toMatchObject({ markdown: "", subsections: [] });

		const root = seeded.scenarios.find((scenario) => scenario.id === "building")!.projectRoot;
		expect(await readFile(join(root, ".aide", "intent.aide"), "utf-8")).toContain("the AIDE methodology as an MCP server and CLI");
	});
});

describe("scenario sets", () => {
	const idsOf = (set: FixtureSet) => scenarios({ set }).map((scenario) => scenario.id);

	it("holds the five Home projects in home and adds the seven ended ones after them in home-many", () => {
		expect(idsOf("home")).toEqual(["aidemdMcp", "aidemdSite", "leadCrawler", "ledgerApi", "docsPortal"]);
		expect(idsOf("home-many")).toEqual([
			...idsOf("home"),
			"billingWorker",
			"searchIndexer",
			"mobileShell",
			"authGateway",
			"metricsAgent",
			"infraScripts",
			"designTokens",
		]);
		expect(new Set(idsOf("home-many")).size).toBe(12);
	});

	it("gives home one waiting gate, on aidemd-site, and three sessions that are live and recent", () => {
		const home = scenarios({ set: "home" });
		const open = home.flatMap(({ id, project }) =>
			project.sessions.flatMap(({ events }) => {
				const opened = events.filter((event) => event.kind === "gate_waiting").length;
				const resolved = events.filter((event) => event.kind === "gate_resolved").length;
				return opened > resolved ? [id] : [];
			}),
		);
		const live = home.flatMap(({ id, project }) =>
			project.sessions.filter((session) => session.pid === "live" && session.events.at(-1)!.offsetMin <= 30).map(() => id),
		);

		expect(open).toEqual(["aidemdSite"]);
		expect(live.sort()).toEqual(["aidemdMcp", "aidemdSite", "leadCrawler"]);
	});

	it("names the handoff's session tasks, event counts and kanban tags", () => {
		const home = Object.fromEntries(scenarios({ set: "home" }).map(({ id, project }) => [id, project]));
		const board = (id: string) => (home[id].board !== null && "tasks" in home[id].board ? home[id].board.kanbanTag : undefined);

		expect(["aidemdMcp", "aidemdSite", "leadCrawler", "ledgerApi", "docsPortal"].map(board)).toEqual(["aidemd", "aidemd-site", "crawler", "ledger", "docs"]);
		expect(home.leadCrawler.sessions.map((session) => session.events.length)).toEqual([77, 260]);
		expect(home.ledgerApi.sessions[0]).toMatchObject({ pid: "live" });
		expect(home.ledgerApi.sessions[0].events).toHaveLength(64);
		expect(home.docsPortal.sessions[0].events).toHaveLength(88);
		expect(home.aidemdSite.files["src/pages/docs/score/plan.aide"]).toMatch(/^---\nstatus: proposed\n/);
	});
});

describe("home sets as the observer reads them", () => {
	let base: string;
	let seeded: SeededFixtures;
	let statuses: Map<string, Awaited<ReturnType<typeof rebuildStatus>>>;

	beforeAll(async () => {
		base = await mkdtemp(join(tmpdir(), "aide-home-scenarios-"));
		vi.stubEnv("LOCALAPPDATA", join(base, "appdata"));
		vi.stubEnv("XDG_STATE_HOME", join(base, "appdata"));

		seeded = await seedFixtures({ appDataRoot: resolveRoot().root, workDir: join(base, "work"), now: Date.now(), set: "home" });

		const projects = await read();
		statuses = new Map();
		for (const scenario of seeded.scenarios) {
			const log = projects.find((project) => project.projectKey === scenario.projectKey);
			if (!log || log.projectRoot === null) continue;
			const sessions = log.sessions.map(({ sessionId, events }) => ({ projectKey: log.projectKey, sessionId, events }));
			statuses.set(scenario.id, await rebuildStatus({ projectKey: log.projectKey, projectRoot: log.projectRoot, sessions }));
		}
	}, SEED_TIMEOUT_MS);

	afterAll(async () => {
		vi.unstubAllEnvs();
		await rm(base, { recursive: true, force: true });
	});

	it("seeds exactly the five Home projects, one session log per session", () => {
		expect(seeded.scenarios.map((scenario) => scenario.id)).toEqual(["aidemdMcp", "aidemdSite", "leadCrawler", "ledgerApi", "docsPortal"]);
		expect(seeded.scenarios.map((scenario) => scenario.sessionIds.length)).toEqual([4, 1, 2, 1, 1]);
	});

	it("reads aidemd-site as waiting on its plan approval, lead-crawler as running QA and ledger-api as idle", () => {
		expect(statuses.get("aidemdSite")!.waiting).toHaveLength(1);
		expect(statuses.get("aidemdSite")!.surfaced).toMatchObject({ file: "src/pages/docs/score/plan.aide", kind: "plan" });
		expect(statuses.get("leadCrawler")!.running[0]).toMatchObject({ phase: "qa", module: "src/crawl/robots" });
		expect(statuses.get("aidemdMcp")!.running[0]).toMatchObject({ phase: "build", buildStep: { reached: 4, total: 9 } });
		expect(statuses.get("ledgerApi")!.sessions.some((session) => session.liveness.state === "working" && session.liveness.maybeStuck)).toBe(true);
		expect(statuses.get("docsPortal")!.sessions.every((session) => session.liveness.state === "ended")).toBe(true);
	});
});
