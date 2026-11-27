import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./locateEntry/index.js", () => ({ default: vi.fn() }));
vi.mock("./ignoreLocal/index.js", () => ({ default: vi.fn() }));

import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HooksCategoryPlan, HooksFilePlan } from "@/types/index.js";
import aidePackage from "../aidePackage/index.js";
import locateEntry from "./locateEntry/index.js";
import ignoreLocal from "./ignoreLocal/index.js";
import planHooks from "./index.js";

const mockLocateEntry = locateEntry as ReturnType<typeof vi.fn>;
const mockIgnoreLocal = ignoreLocal as ReturnType<typeof vi.fn>;

const ENTRY = "C:/npm/node_modules/@aidemd-mcp/server/dist/index.js";
const OLD_ENTRIES = {
	SessionStart: "aidemd-mcp hook",
	UserPromptSubmit: "aidemd-mcp hook",
	PostToolUse: "aidemd-mcp hook",
	Stop: "aidemd-mcp hook",
	SessionEnd: "aidemd-mcp hook",
};

let projectRoot: string;

function localPath(): string {
	return join(projectRoot, ".claude", "settings.local.json");
}

function projectPath(): string {
	return join(projectRoot, ".claude", "settings.json");
}

/** A shared settings file in the form earlier releases wrote, beside a user hook and a permissions block. */
function makeSharedSettings(): string {
	const hooks: Record<string, unknown[]> = Object.fromEntries(
		Object.entries(OLD_ENTRIES).map(([event, command]) => [event, [{ hooks: [{ type: "command", command }] }]]),
	);
	hooks.PreToolUse = [{ matcher: "Write", hooks: [{ type: "command", command: "prettier --write" }] }];
	return `${JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks }, null, 2)}\n`;
}

async function writeSettings({ path, text }: { path: string; text: string }): Promise<void> {
	await mkdir(join(projectRoot, ".claude"), { recursive: true });
	await writeFile(path, text, "utf-8");
}

function plannedFiles(plan: HooksCategoryPlan): HooksFilePlan[] {
	if (plan.state !== "planned") throw new Error(`expected a planned category, got ${plan.state}`);
	return plan.files;
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockLocateEntry.mockResolvedValue(ENTRY);
	mockIgnoreLocal.mockResolvedValue(null);
	projectRoot = await mkdtemp(join(tmpdir(), "aide-plan-hooks-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

describe("planHooks", () => {
	it("plans nothing and reads nothing without a global install", async () => {
		mockLocateEntry.mockResolvedValue(null);

		const plan = await planHooks({ projectRoot });

		expect(plan).toEqual({
			state: "no-global-install",
			filePath: localPath(),
			globalPackage: { name: aidePackage.name, installed: false, installCommand: aidePackage.installCommand },
		});
		expect(mockIgnoreLocal).not.toHaveBeenCalled();
	});

	it("creates the local file in a fresh project and plans no project entry", async () => {
		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files).toHaveLength(1);
		expect(files[0]).toMatchObject({ file: "local", filePath: localPath(), change: "create", tracked: false });
		expect(files[0]!.content).toContain(`node \\"${ENTRY}\\" hook`);
		expect(files[0]!.content).toContain('"timeout": 10');
	});

	it("creates the local file and strips the shared one in a project wired by an earlier release", async () => {
		await writeSettings({ path: projectPath(), text: makeSharedSettings() });

		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files.map(({ file, change }) => [file, change])).toEqual([
			["local", "create"],
			["project", "update"],
		]);
		const stripped = JSON.parse(files[1]!.content!) as { permissions: unknown; hooks: Record<string, unknown> };
		expect(stripped.permissions).toEqual({ allow: ["Bash(ls)"] });
		expect(Object.keys(stripped.hooks)).toEqual(["PreToolUse"]);
	});

	it("plans only the local file as none when it is current and the shared file is clean", async () => {
		const [created] = plannedFiles(await planHooks({ projectRoot }));
		await writeSettings({ path: localPath(), text: created!.content! });
		await writeSettings({ path: projectPath(), text: '{ "permissions": {} }\n' });

		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files).toEqual([{ file: "local", filePath: localPath(), change: "none", tracked: false }]);
	});

	it("updates an outdated local file", async () => {
		await writeSettings({
			path: localPath(),
			text: `${JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "aidemd-mcp hook" }] }] } }, null, 2)}\n`,
		});

		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files).toHaveLength(1);
		expect(files[0]).toMatchObject({ file: "local", change: "update" });
		expect(files[0]!.content).not.toContain('"aidemd-mcp hook"');
	});

	it("stops on a malformed shared file and does not plan the fine local file", async () => {
		await writeSettings({ path: projectPath(), text: "{ not json" });

		const plan = await planHooks({ projectRoot });

		expect(plan.state).toBe("malformed");
		if (plan.state !== "malformed") return;
		expect(plan.files).toHaveLength(1);
		expect(plan.files[0]).toMatchObject({ file: "project", filePath: projectPath() });
		expect(plan.files[0]!.reason).not.toBe("");
		expect(mockIgnoreLocal).not.toHaveBeenCalled();
	});

	it("lists every malformed file, local first", async () => {
		await writeSettings({ path: localPath(), text: "[]" });
		await writeSettings({ path: projectPath(), text: '{ "hooks": 3 }' });

		const plan = await planHooks({ projectRoot });

		expect(plan).toEqual({
			state: "malformed",
			files: [
				{ file: "local", filePath: localPath(), reason: "the root is not a JSON object" },
				{ file: "project", filePath: projectPath(), reason: '"hooks" is not an object' },
			],
		});
	});

	it("includes the gitignore edit and the tracked flag when git does not cover the local file", async () => {
		mockIgnoreLocal.mockResolvedValue({ tracked: true, edit: { change: "update", content: "dist\n.claude/settings.local.json\n" } });

		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files.map(({ file, change }) => [file, change])).toEqual([
			["local", "create"],
			["gitignore", "update"],
		]);
		expect(files[0]!.tracked).toBe(true);
		expect(files[1]).toEqual({
			file: "gitignore",
			filePath: join(projectRoot, ".gitignore"),
			change: "update",
			content: "dist\n.claude/settings.local.json\n",
		});
	});

	it("plans only the local file as none after every planned content is applied", async () => {
		await writeSettings({ path: projectPath(), text: makeSharedSettings() });

		for (const { filePath, content } of plannedFiles(await planHooks({ projectRoot }))) {
			await writeSettings({ path: filePath, text: content! });
		}
		const files = plannedFiles(await planHooks({ projectRoot }));

		expect(files).toEqual([{ file: "local", filePath: localPath(), change: "none", tracked: false }]);
		expect(JSON.parse(await readFile(projectPath(), "utf-8"))).toEqual({
			permissions: { allow: ["Bash(ls)"] },
			hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "prettier --write" }] }] },
		});
	});
});
