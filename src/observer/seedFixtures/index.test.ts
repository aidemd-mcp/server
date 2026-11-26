import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import readBoard from "@/service/observer/kanban/board/read/index.js";
import { schema } from "@/service/observer/event/shared/schema/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import seedFixtures from "./index.js";
import scenarios from "./scenarios/index.js";
import type { FixtureScenario } from "./types/index.js";

vi.mock("./scenarios/index.js", () => ({ default: vi.fn() }));

const NOW = Date.parse("2026-11-23T12:00:00.000Z");

let base: string;
let workDir: string;

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "aide-seed-fixtures-"));
	workDir = join(base, "work");
	vi.stubEnv("AIDEMD_HOME", join(base, "appdata", "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.mocked(scenarios).mockReset();
	await rm(base, { recursive: true, force: true });
});

function makeScenario(overrides: Partial<FixtureScenario["project"]> = {}): FixtureScenario {
	return {
		id: "building",
		label: "Building",
		project: {
			folderName: "aidemd-mcp",
			installed: true,
			files: { ".aide/intent.aide": "root\n" },
			board: { kanbanTag: "aidemd-mcp", tasks: [{ column: "todo", slug: "a-task", title: "A task", priority: "p2", type: "feature" }] },
			reportRoot: true,
			sessions: [{ pid: "live", events: [{ offsetMin: 4, kind: "session_started" }] }],
			...overrides,
		},
	};
}

describe("seedFixtures", () => {
	it("writes one project folder with its files, its board, its brain config and one session log", async () => {
		vi.mocked(scenarios).mockReturnValue([makeScenario()]);
		const appDataRoot = resolveRoot().root;

		const seeded = await seedFixtures({ appDataRoot, workDir, now: NOW, set: "sessions" });

		expect(seeded.scenarios).toHaveLength(1);
		const [only] = seeded.scenarios;
		expect(only).toMatchObject({ id: "building", label: "Building", projectRoot: join(workDir, "building", "aidemd-mcp") });
		expect(only.sessionIds).toHaveLength(1);
		expect(await readdir(appDataRoot)).toEqual([only.projectKey]);

		expect(await readFile(join(only.projectRoot, ".aide", "intent.aide"), "utf-8")).toBe("root\n");
		expect((await stat(join(workDir, "building", "brain", "kanban", "aidemd-mcp", "todo", "a-task.md"))).isFile()).toBe(true);

		const log = await readFile(join(appDataRoot, only.projectKey, "events", `${only.sessionIds[0]}.jsonl`), "utf-8");
		const [started] = log.trimEnd().split("\n").map((line) => schema.parse(JSON.parse(line)));
		expect(started).toMatchObject({ kind: "session_started", projectRoot: only.projectRoot, kanbanTag: "aidemd-mcp" });
		expect(started).not.toHaveProperty("brainPath");

		const config = await parseBrainAide(only.projectRoot);
		expect(config).toMatchObject({ kanban: { state: "declared", path: join(workDir, "building", "brain", "kanban") } });
		expect(await readBoard({ reported: { kanbanTag: "aidemd-mcp" }, projectRoot: only.projectRoot })).toMatchObject({ state: "available" });
	});

	it("writes each session's presence and ended mark, and every logged line passes the v2 schema", async () => {
		vi.mocked(scenarios).mockReturnValue([
			makeScenario({
				sessions: [
					{ pid: "live", presence: { state: "waiting", minutesAgo: 2 }, events: [{ offsetMin: 4, kind: "session_started" }] },
					{ pid: "dead", ended: true, events: [{ offsetMin: 90, kind: "session_started" }, { offsetMin: 80, kind: "pipeline_started", pipeline: "a-task", phase: "spec" }] },
					{ pid: "live", events: [{ offsetMin: 3, kind: "session_started" }] },
				],
			}),
		]);
		const appDataRoot = resolveRoot().root;

		const [only] = (await seedFixtures({ appDataRoot, workDir, now: NOW, set: "sessions" })).scenarios;

		const [waiting, ended, bare] = only.sessionIds;
		expect(await readdir(join(appDataRoot, only.projectKey, "presence"))).toEqual([`fixture-${waiting}.json`]);
		expect(await readdir(join(appDataRoot, only.projectKey, "ended"))).toEqual([`${ended}.json`]);
		expect(bare).toBeDefined();
		for (const sessionId of only.sessionIds) {
			const log = await readFile(join(appDataRoot, only.projectKey, "events", `${sessionId}.jsonl`), "utf-8");
			for (const line of log.trimEnd().split("\n")) expect(schema.parse(JSON.parse(line)).v).toBe(2);
		}
	});

	it("leaves an uninstalled project's root empty and reports no root when reportRoot is false", async () => {
		vi.mocked(scenarios).mockReturnValue([makeScenario({ installed: false, reportRoot: false, board: null })]);
		const appDataRoot = resolveRoot().root;

		const [only] = (await seedFixtures({ appDataRoot, workDir, now: NOW, set: "sessions" })).scenarios;

		expect(await readdir(only.projectRoot)).toEqual([]);
		const log = await readFile(join(appDataRoot, only.projectKey, "events", `${only.sessionIds[0]}.jsonl`), "utf-8");
		const started = JSON.parse(log.split("\n")[0]);
		expect(started).not.toHaveProperty("projectRoot");
		expect(started).not.toHaveProperty("brainPath");
		expect(started).not.toHaveProperty("kanbanTag");
	});

	it("writes the brain config but never the brain folder for a missing-brain board", async () => {
		vi.mocked(scenarios).mockReturnValue([makeScenario({ board: { kanbanTag: "aidemd-mcp", missingBrain: true } })]);
		const appDataRoot = resolveRoot().root;

		const [only] = (await seedFixtures({ appDataRoot, workDir, now: NOW, set: "sessions" })).scenarios;

		await expect(stat(join(workDir, "building", "brain"))).rejects.toThrow();
		expect((await stat(join(only.projectRoot, ".aide", "config", "brain.aide"))).isFile()).toBe(true);
		expect(await readBoard({ reported: { kanbanTag: "aidemd-mcp" }, projectRoot: only.projectRoot })).toMatchObject({
			state: "unavailable",
			reason: "kanban-folder-missing",
		});
	});

	it("refuses to seed when the environment resolves a different app-data root, writing nothing", async () => {
		vi.mocked(scenarios).mockReturnValue([makeScenario()]);

		await expect(seedFixtures({ appDataRoot: join(base, "elsewhere"), workDir, now: NOW, set: "sessions" })).rejects.toThrow("refusing to seed");

		await expect(stat(workDir)).rejects.toThrow();
		await expect(stat(resolveRoot().root)).rejects.toThrow();
	});
});

describe("seedFixtures sets", () => {
	it("seeds the scenarios of the set it is given and nothing else", async () => {
		vi.mocked(scenarios).mockImplementation(({ set }) => [makeScenario({ folderName: set })]);
		const appDataRoot = resolveRoot().root;

		const seeded = await seedFixtures({ appDataRoot, workDir, now: NOW, set: "home" });

		expect(scenarios).toHaveBeenCalledWith({ set: "home" });
		expect(seeded.scenarios.map((scenario) => scenario.projectRoot)).toEqual([join(workDir, "building", "home")]);
		expect(await readdir(appDataRoot)).toHaveLength(1);
	});
});
