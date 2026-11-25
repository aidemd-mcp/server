import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import installHooks from "./index.js";
import init, { InitInput } from "../index.js";
import applySteps from "../applySteps/index.js";
import planHooksMerge from "../shared/planHooksMerge/index.js";
import type { FrameworkType } from "@/types/index.js";

vi.mock("../shared/checkGlobalPackage/index.js", () => ({ default: vi.fn(async () => false) }));

const STEP_NAME = "Claude Code hooks (.claude/settings.json)";

let tempDir: string;
let settingsPath: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-hooks-"));
	settingsPath = join(tempDir, ".claude", "settings.json");
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function writeSettings(text: string): Promise<void> {
	await mkdir(join(tempDir, ".claude"), { recursive: true });
	await writeFile(settingsPath, text, "utf-8");
}

describe("installHooks", () => {
	it.each<FrameworkType>(["cursor", "windsurf", "copilot"])("returns no step for the %s framework", async (framework) => {
		expect(await installHooks({ projectRoot: tempDir, framework })).toEqual([]);
	});

	it("plans would-create with the merged content when no settings file exists", async () => {
		const [step, ...rest] = await installHooks({ projectRoot: tempDir, framework: "claude" });

		expect(rest).toEqual([]);
		expect(step).toMatchObject({ name: STEP_NAME, status: "would-create", category: "hooks", filePath: settingsPath });
		expect(step.content).toBe((planHooksMerge({ text: null }) as { merged: string }).merged);
	});

	it("plans would-overwrite with the merged content when entries are missing", async () => {
		const existing = '{\n  "model": "opus"\n}\n';
		await writeSettings(existing);

		const [step] = await installHooks({ projectRoot: tempDir, framework: "claude" });

		expect(step).toMatchObject({ name: STEP_NAME, status: "would-overwrite", category: "hooks", filePath: settingsPath });
		expect(step.content).toBe((planHooksMerge({ text: existing }) as { merged: string }).merged);
	});

	it("plans exists, with no content, when every entry is present", async () => {
		const merged = (planHooksMerge({ text: null }) as { merged: string }).merged;
		await writeSettings(merged);

		const [step] = await installHooks({ projectRoot: tempDir, framework: "claude" });

		expect(step).toMatchObject({ name: STEP_NAME, status: "exists", category: "hooks", filePath: settingsPath });
		expect(step.content).toBeUndefined();
	});

	it("plans would-skip with configMalformed when the file cannot be parsed", async () => {
		await writeSettings("{ not json");

		const [step] = await installHooks({ projectRoot: tempDir, framework: "claude" });

		expect(step).toMatchObject({ name: STEP_NAME, status: "would-skip", category: "hooks", configMalformed: true });
		expect(step.content).toBeUndefined();
	});

	it("never writes the settings file itself", async () => {
		await installHooks({ projectRoot: tempDir, framework: "claude" });

		await expect(readFile(settingsPath, "utf-8")).rejects.toThrow();
	});
});

describe("init hooks category", () => {
	it("accepts hooks as an InitInput category", () => {
		expect(InitInput.safeParse({ category: "hooks" }).success).toBe(true);
	});

	it("places the hooks step after the Zed step and before the readme step", async () => {
		const result = await init(tempDir, "claude");

		const names = result.steps.map((s) => s.name);
		expect(names.indexOf(STEP_NAME)).toBe(names.indexOf("Zed config") + 1);
		expect(result.steps[names.indexOf(STEP_NAME) + 1].category).toBe("readme");
	});

	it("writes the merged file through applySteps and a re-run reports exists", async () => {
		const first = await init(tempDir, "claude");
		const hookSteps = first.steps.filter((s) => s.category === "hooks");
		expect(hookSteps).toHaveLength(1);
		expect(hookSteps[0].status).toBe("would-create");

		await applySteps(hookSteps);

		const second = await init(tempDir, "claude");
		expect(second.steps.filter((s) => s.category === "hooks").map((s) => s.status)).toEqual(["exists"]);
	});

	it("keeps a user's other hook and every other key byte-for-byte", async () => {
		const userHook = '{ "type": "command", "command": "echo mine" }';
		const original = `{\n\t"model": "opus",\n\t"hooks": {\n\t\t"Stop": [\n\t\t\t{ "hooks": [${userHook}] }\n\t\t]\n\t}\n}\n`;
		await writeSettings(original);

		const result = await init(tempDir, "claude");
		const [step] = result.steps.filter((s) => s.category === "hooks");
		expect(step.status).toBe("would-overwrite");
		await applySteps([step]);

		const written = await readFile(settingsPath, "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.model).toBe("opus");
		expect(parsed.hooks.Stop[0]).toEqual({ hooks: [{ type: "command", command: "echo mine" }] });
		expect(written).toContain(`\t\t\t{ "hooks": [${userHook}] }`);
		expect(written.startsWith('{\n\t"model": "opus",\n\t"hooks": {\n\t\t"Stop": [\n')).toBe(true);

		const again = await init(tempDir, "claude");
		expect(again.steps.filter((s) => s.category === "hooks").map((s) => s.status)).toEqual(["exists"]);
	});
});
