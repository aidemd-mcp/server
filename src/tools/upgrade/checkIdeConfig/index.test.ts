import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock fs/promises before imports
vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

// Mock child_process to avoid spawning `code`
vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { checkZedConfig, checkVscodeExtension } from "./index.js";

const mockReadFile = readFile as Mock;
// execFile has complex overloads — cast to avoid TS inferring the overload set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecFile = vi.mocked(execFile as any);

const PROJECT_ROOT = "/project";
const ZED_SETTINGS_PATH = join(PROJECT_ROOT, ".zed", "settings.json");

function enoent(): NodeJS.ErrnoException {
	const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
	err.code = "ENOENT";
	return err;
}

beforeEach(() => {
	vi.resetAllMocks();
});

// ── checkZedConfig ─────────────────────────────────────────────────────────────

describe("checkZedConfig", () => {
	describe("settings file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns status 'missing'", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.status).toBe("missing");
		});

		it("returns category 'ide'", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.category).toBe("ide");
		});

		it("includes canonicalContent with *.aide association", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.canonicalContent).toBeTruthy();
			const parsed = JSON.parse(result.canonicalContent!);
			expect(parsed.file_types.Markdown).toContain("*.aide");
		});

		it("includes filePath pointing to .zed/settings.json", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.filePath).toBe(ZED_SETTINGS_PATH);
		});
	});

	describe("settings file exists with *.aide already present", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({ file_types: { Markdown: ["*.aide", "*.md"] } }, null, 2) + "\n",
			);
		});

		it("returns status 'matches'", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.status).toBe("matches");
		});

		it("does not include canonicalContent", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.canonicalContent).toBeUndefined();
		});
	});

	describe("settings file exists without *.aide", () => {
		const existing = JSON.stringify({ file_types: { Markdown: ["*.md"] } }, null, 2) + "\n";

		beforeEach(() => {
			mockReadFile.mockResolvedValue(existing);
		});

		it("returns status 'differs'", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.status).toBe("differs");
		});

		it("canonicalContent includes *.aide added to the Markdown list", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.canonicalContent).toBeTruthy();
			const parsed = JSON.parse(result.canonicalContent!);
			expect(parsed.file_types.Markdown).toContain("*.aide");
			expect(parsed.file_types.Markdown).toContain("*.md");
		});
	});

	describe("settings file exists but is malformed JSON", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue("{ not valid json }");
		});

		it("returns status 'malformed'", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.status).toBe("malformed");
		});

		it("does not include canonicalContent", async () => {
			const result = await checkZedConfig(PROJECT_ROOT);
			expect(result.canonicalContent).toBeUndefined();
		});
	});
});

// ── checkVscodeExtension ───────────────────────────────────────────────────────

describe("checkVscodeExtension", () => {
	describe("code CLI not available", () => {
		beforeEach(() => {
			// Simulate execFileAsync rejecting for `code --version`
			mockExecFile.mockImplementation(
				(_cmd: unknown, _args: unknown, cb: (err: Error | null) => void) => {
					cb(new Error("code not found"));
				},
			);
		});

		it("returns status 'matches' (cannot determine state)", async () => {
			const result = await checkVscodeExtension();
			expect(result.status).toBe("matches");
		});

		it("returns category 'ide'", async () => {
			const result = await checkVscodeExtension();
			expect(result.category).toBe("ide");
		});
	});

	describe("code CLI available, extension installed", () => {
		beforeEach(() => {
			mockExecFile
				.mockImplementationOnce(
					// --version succeeds
					(_cmd: unknown, _args: unknown, cb: (err: null, result: { stdout: string }) => void) => {
						cb(null, { stdout: "1.80.0\n" });
					},
				)
				.mockImplementationOnce(
					// --list-extensions includes aide-markdown
					(_cmd: unknown, _args: unknown, cb: (err: null, result: { stdout: string }) => void) => {
						cb(null, { stdout: "ms-vscode.aide-markdown\nms-python.python\n" });
					},
				);
		});

		it("returns status 'matches'", async () => {
			const result = await checkVscodeExtension();
			expect(result.status).toBe("matches");
		});
	});

	describe("code CLI available, extension not installed", () => {
		beforeEach(() => {
			mockExecFile
				.mockImplementationOnce(
					// --version succeeds
					(_cmd: unknown, _args: unknown, cb: (err: null, result: { stdout: string }) => void) => {
						cb(null, { stdout: "1.80.0\n" });
					},
				)
				.mockImplementationOnce(
					// --list-extensions does not include aide-markdown
					(_cmd: unknown, _args: unknown, cb: (err: null, result: { stdout: string }) => void) => {
						cb(null, { stdout: "ms-python.python\nms-vscode.cpptools\n" });
					},
				);
		});

		it("returns status 'differs'", async () => {
			const result = await checkVscodeExtension();
			expect(result.status).toBe("differs");
		});

		it("includes canonicalContent pointing to the vsix path", async () => {
			const result = await checkVscodeExtension();
			expect(result.canonicalContent).toBeTruthy();
			expect(result.canonicalContent).toContain("aide-markdown-0.0.1.vsix");
		});
	});
});
