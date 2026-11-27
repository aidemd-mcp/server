import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FrameworkType, HooksCategoryPlan } from "@/types/index.js";

vi.mock("@/service/install/shared/planHooks/index.js", () => ({ default: vi.fn() }));

import planHooks from "@/service/install/shared/planHooks/index.js";
import checkHooksConfig from "./index.js";

const mockPlanHooks = planHooks as ReturnType<typeof vi.fn>;

const LOCAL_NAME = "Claude Code hooks (.claude/settings.local.json)";
const PROJECT_NAME = "AIDE hooks removed from shared settings (.claude/settings.json)";
const GITIGNORE_NAME = ".gitignore entry for .claude/settings.local.json";

const ROOT = "/proj";
const LOCAL_PATH = "/proj/.claude/settings.local.json";
const PROJECT_PATH = "/proj/.claude/settings.json";
const GITIGNORE_PATH = "/proj/.gitignore";

const TRACKED_TIP =
	"`.claude/settings.local.json` is tracked by git, so this machine's hook paths would be committed. Untracking it (`git rm --cached .claude/settings.local.json`) is the user's call; AIDE never runs it.";

function plan(value: HooksCategoryPlan): void {
	mockPlanHooks.mockResolvedValue(value);
}

const check = () => checkHooksConfig({ projectRoot: ROOT, framework: "claude" });

beforeEach(() => {
	vi.clearAllMocks();
});

describe("checkHooksConfig: framework gate", () => {
	it.each<FrameworkType>(["cursor", "windsurf", "copilot"])("returns [] for %s without calling planHooks", async (framework) => {
		expect(await checkHooksConfig({ projectRoot: ROOT, framework })).toEqual([]);
		expect(mockPlanHooks).not.toHaveBeenCalled();
	});

	it("passes the project root to planHooks", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false }] });

		await check();

		expect(mockPlanHooks).toHaveBeenCalledWith({ projectRoot: ROOT });
	});
});

describe("checkHooksConfig: stop states", () => {
	it("no global install: one missing local result with globalPackage, instructions and no content", async () => {
		const globalPackage = { name: "@aidemd-mcp/server", installed: false as const, installCommand: "npm i -g @aidemd-mcp/server" };
		plan({ state: "no-global-install", filePath: LOCAL_PATH, globalPackage });

		expect(await check()).toEqual([
			{
				name: LOCAL_NAME,
				filePath: LOCAL_PATH,
				status: "missing",
				category: "hooks",
				globalPackage,
				instructions:
					"The aide server is not installed globally, so AIDE's hooks have nothing to run and none were planned. Run `npm i -g @aidemd-mcp/server` via Bash, then apply the hooks category again. If the install fails, tell the user and write no hooks.",
			},
		]);
	});

	it("both files malformed: two malformed results, local first, with instructions and no content", async () => {
		plan({
			state: "malformed",
			files: [
				{ file: "local", filePath: LOCAL_PATH, reason: "the root is not a JSON object" },
				{ file: "project", filePath: PROJECT_PATH, reason: "ValueExpected at offset 3" },
			],
		});

		const results = await check();

		expect(results.map((r) => [r.name, r.filePath, r.status, r.category, r.canonicalContent])).toEqual([
			[LOCAL_NAME, LOCAL_PATH, "malformed", "hooks", undefined],
			[PROJECT_NAME, PROJECT_PATH, "malformed", "hooks", undefined],
		]);
		expect(results[0].instructions).toBe(
			"`.claude/settings.local.json` cannot be parsed (the root is not a JSON object), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.",
		);
		expect(results[1].instructions).toBe(
			"`.claude/settings.json` cannot be parsed (ValueExpected at offset 3), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.",
		);
	});
});

describe("checkHooksConfig: planned files", () => {
	it("a shared-only project: local missing and project differs, contents passed through in order", async () => {
		plan({
			state: "planned",
			files: [
				{ file: "local", filePath: LOCAL_PATH, change: "create", content: "LOCAL", tracked: false },
				{ file: "project", filePath: PROJECT_PATH, change: "update", content: "STRIPPED" },
			],
		});

		expect(await check()).toEqual([
			{ name: LOCAL_NAME, filePath: LOCAL_PATH, status: "missing", category: "hooks", canonicalContent: "LOCAL" },
			{ name: PROJECT_NAME, filePath: PROJECT_PATH, status: "differs", category: "hooks", canonicalContent: "STRIPPED" },
		]);
	});

	it("an outdated local file: differs with content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "update", content: "NEW", tracked: false }] });

		expect(await check()).toEqual([
			{ name: LOCAL_NAME, filePath: LOCAL_PATH, status: "differs", category: "hooks", canonicalContent: "NEW" },
		]);
	});

	it("a current local file and nothing else: one matches result with no content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false }] });

		expect(await check()).toEqual([{ name: LOCAL_NAME, filePath: LOCAL_PATH, status: "matches", category: "hooks" }]);
	});

	it("a tracked current local file: tip present and status still matches", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: true }] });

		const [result] = await check();

		expect(result.status).toBe("matches");
		expect(result.tip).toBe(TRACKED_TIP);
		expect(result.canonicalContent).toBeUndefined();
	});

	it("a tracked local file that changes: tip beside the content", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "update", content: "NEW", tracked: true }] });

		const [result] = await check();

		expect(result.status).toBe("differs");
		expect(result.tip).toBe(TRACKED_TIP);
		expect(result.canonicalContent).toBe("NEW");
	});

	it("an untracked local file carries no tip", async () => {
		plan({ state: "planned", files: [{ file: "local", filePath: LOCAL_PATH, change: "update", content: "NEW", tracked: false }] });

		const [result] = await check();

		expect(result).not.toHaveProperty("tip");
	});

	it.each<{ change: "create" | "update"; status: "missing" | "differs"; content: string }>([
		{ change: "create", status: "missing", content: ".claude/settings.local.json\n" },
		{ change: "update", status: "differs", content: "node_modules\n.claude/settings.local.json\n" },
	])("a gitignore $change is $status with its content", async ({ change, status, content }) => {
		plan({
			state: "planned",
			files: [
				{ file: "local", filePath: LOCAL_PATH, change: "none", tracked: false },
				{ file: "gitignore", filePath: GITIGNORE_PATH, change, content },
			],
		});

		expect((await check())[1]).toEqual({
			name: GITIGNORE_NAME,
			filePath: GITIGNORE_PATH,
			status,
			category: "hooks",
			canonicalContent: content,
		});
	});

	it("local, project and gitignore results come back in plan order", async () => {
		plan({
			state: "planned",
			files: [
				{ file: "local", filePath: LOCAL_PATH, change: "create", content: "L", tracked: false },
				{ file: "project", filePath: PROJECT_PATH, change: "update", content: "P" },
				{ file: "gitignore", filePath: GITIGNORE_PATH, change: "create", content: "G" },
			],
		});

		expect((await check()).map((r) => [r.name, r.status])).toEqual([
			[LOCAL_NAME, "missing"],
			[PROJECT_NAME, "differs"],
			[GITIGNORE_NAME, "missing"],
		]);
	});
});
