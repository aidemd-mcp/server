import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./inspectGit/index.js", () => ({ default: vi.fn() }));

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import inspectGit from "./inspectGit/index.js";
import ignoreLocal from "./index.js";

const mockInspectGit = inspectGit as ReturnType<typeof vi.fn>;

let projectRoot: string;

beforeEach(async () => {
	vi.clearAllMocks();
	projectRoot = await mkdtemp(join(tmpdir(), "aide-ignore-local-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

describe("ignoreLocal", () => {
	it("asks git about the local settings file", async () => {
		mockInspectGit.mockResolvedValue(null);

		await ignoreLocal({ projectRoot });

		expect(mockInspectGit).toHaveBeenCalledWith({ projectRoot, path: ".claude/settings.local.json" });
	});

	it("is null outside a git work tree", async () => {
		mockInspectGit.mockResolvedValue(null);

		await expect(ignoreLocal({ projectRoot })).resolves.toBeNull();
	});

	it("plans no edit when git already ignores the file", async () => {
		mockInspectGit.mockResolvedValue({ ignored: true, tracked: false });

		await expect(ignoreLocal({ projectRoot })).resolves.toEqual({ tracked: false, edit: null });
	});

	it("passes tracked through when the file is ignored but tracked", async () => {
		mockInspectGit.mockResolvedValue({ ignored: true, tracked: true });

		await expect(ignoreLocal({ projectRoot })).resolves.toEqual({ tracked: true, edit: null });
	});

	it("creates .gitignore when none exists", async () => {
		mockInspectGit.mockResolvedValue({ ignored: false, tracked: false });

		await expect(ignoreLocal({ projectRoot })).resolves.toEqual({
			tracked: false,
			edit: { change: "create", content: ".claude/settings.local.json\n" },
		});
	});

	it("appends to an existing .gitignore, keeping its bytes and line endings", async () => {
		mockInspectGit.mockResolvedValue({ ignored: false, tracked: true });
		await writeFile(join(projectRoot, ".gitignore"), "node_modules\r\ndist", "utf-8");

		await expect(ignoreLocal({ projectRoot })).resolves.toEqual({
			tracked: true,
			edit: { change: "update", content: "node_modules\r\ndist\r\n.claude/settings.local.json\r\n" },
		});
	});
});
