import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import compareFile from "./index.js";

const mockReadFile = readFile as Mock;

const HOST_PATH = "/project/.aide/docs/index.md";
const CANONICAL = "# canonical content\n";
const DIFFERENT = "# different content\n";

function enoent(): NodeJS.ErrnoException {
	const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
	err.code = "ENOENT";
	return err;
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("compareFile", () => {
	describe("file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns 'missing'", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL);
			expect(status).toBe("missing");
		});
	});

	describe("file exists, content matches canonical", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(CANONICAL);
		});

		it("returns 'matches'", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL);
			expect(status).toBe("matches");
		});
	});

	describe("file exists, content differs", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(DIFFERENT);
		});

		it("returns 'differs'", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL);
			expect(status).toBe("differs");
		});
	});

	describe("no filesystem writes occur", () => {
		it("never calls writeFile or mkdir regardless of file state", async () => {
			// Verify the module does not import write functions by ensuring the
			// function only calls readFile.
			mockReadFile.mockResolvedValue(CANONICAL);
			await compareFile(HOST_PATH, CANONICAL);
			// readFile was called once; no other fs calls happen (writeFile/mkdir
			// are not imported by the refactored module).
			expect(mockReadFile).toHaveBeenCalledOnce();
			expect(mockReadFile).toHaveBeenCalledWith(HOST_PATH, "utf-8");
		});
	});

	describe("readFile throws a non-ENOENT error", () => {
		it("re-throws the error without swallowing it", async () => {
			const permissionError = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
			permissionError.code = "EACCES";
			mockReadFile.mockRejectedValue(permissionError);

			await expect(compareFile(HOST_PATH, CANONICAL)).rejects.toThrow("EACCES");
		});
	});
});
