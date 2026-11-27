import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FrameworkType, HooksCategoryPlan } from "@/types/index.js";

vi.mock("../shared/planHooks/index.js", () => ({ default: vi.fn() }));
vi.mock("../shared/checkGlobalPackage/index.js", () => ({ default: vi.fn(async () => false) }));

import installHooks from "./index.js";
import planHooks from "../shared/planHooks/index.js";
import init, { InitInput } from "../index.js";

const mockPlanHooks = planHooks as ReturnType<typeof vi.fn>;

const LOCAL_NAME = "Claude Code hooks (.claude/settings.local.json)";
const PROJECT_NAME = "AIDE hooks removed from shared settings (.claude/settings.json)";
const GITIGNORE_NAME = ".gitignore entry for .claude/settings.local.json";

const ROOT = "/proj";
const LOCAL_PATH = "/proj/.claude/settings.local.json";
const PROJECT_PATH = "/proj/.claude/settings.json";
const GITIGNORE_PATH = "/proj/.gitignore";

function plan(value: HooksCategoryPlan): void {
	mockPlanHooks.mockResolvedValue(value);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("installHooks", () => {
	it.each<FrameworkType>(["cursor", "windsurf", "copilot"])("returns no step for %s and never calls planHooks", async (framework) => {
		expect(await installHooks({ projectRoot: ROOT, framework })).toEqual([]);
		expect(mockPlanHooks).not.toHaveBeenCalled();
	});

	it("passes the project root to planHooks", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false }] });

		await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(mockPlanHooks).toHaveBeenCalledWith({ projectRoot: ROOT });
	});

	it("maps no-global-install to one would-skip step with the install-first instructions", async () => {
		const globalPackage = { name: "@aidemd-mcp/server", installed: false as const, installCommand: "npm i -g @aidemd-mcp/server" };
		plan({ state: "no-global-install", filePath: LOCAL_PATH, globalPackage });

		const steps = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(steps).toEqual([
			{
				name: LOCAL_NAME,
				status: "would-skip",
				category: "hooks",
				filePath: LOCAL_PATH,
				globalPackage,
				instructions:
					"The aide server is not installed globally, so AIDE's hooks have nothing to run and none were planned. Run `npm i -g @aidemd-mcp/server` via Bash, then apply the hooks category again. If the install fails, tell the user and write no hooks.",
			},
		]);
	});

	it("maps a malformed file to one would-skip step under that file's name", async () => {
		plan({ state: "malformed", files: [{ file: "project", filePath: PROJECT_PATH, reason: "ValueExpected at offset 3" }] });

		const steps = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(steps).toEqual([
			{
				name: PROJECT_NAME,
				status: "would-skip",
				category: "hooks",
				filePath: PROJECT_PATH,
				configMalformed: true,
				instructions:
					"`.claude/settings.json` cannot be parsed (ValueExpected at offset 3), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.",
			},
		]);
	});

	it("maps two malformed files to two steps, local first", async () => {
		plan({
			state: "malformed",
			files: [
				{ file: "local", filePath: LOCAL_PATH, reason: "the root is not a JSON object" },
				{ file: "project", filePath: PROJECT_PATH, reason: '"hooks" is not an object' },
			],
		});

		const steps = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(steps.map((s) => [s.name, s.status, s.configMalformed])).toEqual([
			[LOCAL_NAME, "would-skip", true],
			[PROJECT_NAME, "would-skip", true],
		]);
		expect(steps[0].instructions).toBe(
			"`.claude/settings.local.json` cannot be parsed (the root is not a JSON object), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.",
		);
	});

	it("maps a local create to would-create with content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "create", content: "{}\n", tracked: false }] });

		expect(await installHooks({ projectRoot: ROOT, framework: "claude" })).toEqual([
			{ name: LOCAL_NAME, status: "would-create", category: "hooks", filePath: LOCAL_PATH, content: "{}\n" },
		]);
	});

	it("maps a local update to would-overwrite with content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "update", content: "{\n}\n", tracked: true }] });

		expect(await installHooks({ projectRoot: ROOT, framework: "claude" })).toEqual([
			{ name: LOCAL_NAME, status: "would-overwrite", category: "hooks", filePath: LOCAL_PATH, content: "{\n}\n" },
		]);
	});

	it("maps a local none to exists with no content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false }] });

		const [step] = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(step).toEqual({ name: LOCAL_NAME, status: "exists", category: "hooks", filePath: LOCAL_PATH });
	});

	it("maps local, project and gitignore files in order, all in the hooks category", async () => {
		plan({
			state: "planned",
			files: [
				{ file: "local", filePath: LOCAL_PATH, change: "create", content: "L", tracked: false },
				{ file: "project", filePath: PROJECT_PATH, change: "update", content: "P" },
				{ file: "gitignore", filePath: GITIGNORE_PATH, change: "create", content: "G" },
			],
		});

		const steps = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(steps.map((s) => [s.name, s.status, s.filePath, s.content, s.category])).toEqual([
			[LOCAL_NAME, "would-create", LOCAL_PATH, "L", "hooks"],
			[PROJECT_NAME, "would-overwrite", PROJECT_PATH, "P", "hooks"],
			[GITIGNORE_NAME, "would-create", GITIGNORE_PATH, "G", "hooks"],
		]);
	});

	it("maps a gitignore update to would-overwrite", async () => {
		plan({
			state: "planned",
			files: [
				{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false },
				{ file: "gitignore", filePath: GITIGNORE_PATH, change: "update", content: "node_modules\n.claude/settings.local.json\n" },
			],
		});

		const [, gitignore] = await installHooks({ projectRoot: ROOT, framework: "claude" });

		expect(gitignore).toMatchObject({ name: GITIGNORE_NAME, status: "would-overwrite", filePath: GITIGNORE_PATH });
	});
});

describe("init hooks category", () => {
	it("accepts hooks as an InitInput category", () => {
		expect(InitInput.safeParse({ category: "hooks" }).success).toBe(true);
	});

	it("places the hooks step after the Zed step and before the readme step", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false }] });

		const result = await init(ROOT, "claude");

		const names = result.steps.map((s) => s.name);
		expect(names.indexOf(LOCAL_NAME)).toBe(names.indexOf("Zed config") + 1);
		expect(result.steps[names.indexOf(LOCAL_NAME) + 1].category).toBe("readme");
	});
});
