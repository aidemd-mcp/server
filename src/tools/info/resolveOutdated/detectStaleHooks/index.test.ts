import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/install/detectFramework/index.js", () => ({
	default: vi.fn(),
}));

vi.mock("@/tools/upgrade/checkHooksConfig/index.js", () => ({
	default: vi.fn(),
}));

import detectFramework from "@/service/install/detectFramework/index.js";
import checkHooksConfig from "@/tools/upgrade/checkHooksConfig/index.js";
import detectStaleHooks from "./index.js";

const mockDetectFramework = detectFramework as ReturnType<typeof vi.fn>;
const mockCheckHooksConfig = checkHooksConfig as ReturnType<typeof vi.fn>;

const root = "/project/root";

function makeResult(status: string) {
	return { name: "Claude Code hooks", filePath: "/project/root/.claude/settings.json", status, category: "hooks" };
}

describe("detectStaleHooks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDetectFramework.mockResolvedValue({ framework: "claude" });
		mockCheckHooksConfig.mockResolvedValue([makeResult("matches")]);
	});

	it.each(["missing", "differs", "malformed"])("returns true when the hooks check reports %s", async (status) => {
		mockCheckHooksConfig.mockResolvedValue([makeResult(status)]);

		expect(await detectStaleHooks(root)).toBe(true);
	});

	it("returns true when the local file matches but AIDE hooks are left in the shared settings", async () => {
		mockCheckHooksConfig.mockResolvedValue([
			makeResult("matches"),
			{ ...makeResult("differs"), filePath: "/project/root/.claude/settings.json" },
		]);

		expect(await detectStaleHooks(root)).toBe(true);
	});

	it("returns true when the local file matches but .gitignore lacks the local-file line", async () => {
		mockCheckHooksConfig.mockResolvedValue([
			makeResult("matches"),
			{ ...makeResult("missing"), filePath: "/project/root/.gitignore" },
		]);

		expect(await detectStaleHooks(root)).toBe(true);
	});

	it("returns true when the only result is a missing global install", async () => {
		mockCheckHooksConfig.mockResolvedValue([
			{
				...makeResult("missing"),
				globalPackage: { installCommand: "npm i -g @aidemd-mcp/server" },
				instructions: "The aide server is not installed globally.",
			},
		]);

		expect(await detectStaleHooks(root)).toBe(true);
	});

	it("returns false when the local file matches and carries a tracked-file tip", async () => {
		mockCheckHooksConfig.mockResolvedValue([{ ...makeResult("matches"), tip: "settings.local.json is tracked by git" }]);

		expect(await detectStaleHooks(root)).toBe(false);
	});

	it("returns false when the hooks match", async () => {
		expect(await detectStaleHooks(root)).toBe(false);
	});

	it("returns false when the framework has no hooks (empty result)", async () => {
		mockDetectFramework.mockResolvedValue({ framework: "cursor" });
		mockCheckHooksConfig.mockResolvedValue([]);

		expect(await detectStaleHooks(root)).toBe(false);
	});

	it("passes the detected framework to the hooks check, with no override", async () => {
		mockDetectFramework.mockResolvedValue({ framework: "windsurf" });
		mockCheckHooksConfig.mockResolvedValue([]);

		await detectStaleHooks(root);

		expect(mockDetectFramework).toHaveBeenCalledWith(root);
		expect(mockCheckHooksConfig).toHaveBeenCalledWith({ projectRoot: root, framework: "windsurf" });
	});

	it("returns false when framework detection rejects", async () => {
		mockDetectFramework.mockRejectedValue(new Error("boom"));

		expect(await detectStaleHooks(root)).toBe(false);
		expect(mockCheckHooksConfig).not.toHaveBeenCalled();
	});

	it("returns false when the hooks check rejects", async () => {
		mockCheckHooksConfig.mockRejectedValue(new Error("EACCES"));

		expect(await detectStaleHooks(root)).toBe(false);
	});
});
