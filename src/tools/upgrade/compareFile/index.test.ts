import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import compareFile from "./index.js";

const mockReadFile = readFile as Mock;
const mockWriteFile = writeFile as Mock;
const mockMkdir = mkdir as Mock;

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
	mockWriteFile.mockResolvedValue(undefined);
	mockMkdir.mockResolvedValue(undefined);
});

describe("compareFile", () => {
	describe("file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns 'would create' when write=false", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, false);
			expect(status).toBe("would create");
		});

		it("does not call writeFile or mkdir when write=false", async () => {
			await compareFile(HOST_PATH, CANONICAL, false);
			expect(mockWriteFile).not.toHaveBeenCalled();
			expect(mockMkdir).not.toHaveBeenCalled();
		});

		it("returns 'created' when write=true", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, true);
			expect(status).toBe("created");
		});

		it("calls mkdir with the parent dir and recursive=true when write=true", async () => {
			await compareFile(HOST_PATH, CANONICAL, true);
			expect(mockMkdir).toHaveBeenCalledOnce();
			expect(mockMkdir).toHaveBeenCalledWith("/project/.aide/docs", { recursive: true });
		});

		it("calls writeFile with the canonical content when write=true", async () => {
			await compareFile(HOST_PATH, CANONICAL, true);
			expect(mockWriteFile).toHaveBeenCalledOnce();
			expect(mockWriteFile).toHaveBeenCalledWith(HOST_PATH, CANONICAL, "utf-8");
		});
	});

	describe("file exists, content matches canonical", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(CANONICAL);
		});

		it("returns 'unchanged' when write=false", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, false);
			expect(status).toBe("unchanged");
		});

		it("returns 'unchanged' when write=true", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, true);
			expect(status).toBe("unchanged");
		});

		it("does not call writeFile regardless of the write flag", async () => {
			await compareFile(HOST_PATH, CANONICAL, false);
			await compareFile(HOST_PATH, CANONICAL, true);
			expect(mockWriteFile).not.toHaveBeenCalled();
		});
	});

	describe("file exists, content differs", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(DIFFERENT);
		});

		it("returns 'would update' when write=false", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, false);
			expect(status).toBe("would update");
		});

		it("does not call writeFile when write=false", async () => {
			await compareFile(HOST_PATH, CANONICAL, false);
			expect(mockWriteFile).not.toHaveBeenCalled();
		});

		it("returns 'updated' when write=true", async () => {
			const status = await compareFile(HOST_PATH, CANONICAL, true);
			expect(status).toBe("updated");
		});

		it("calls writeFile with the canonical content when write=true", async () => {
			await compareFile(HOST_PATH, CANONICAL, true);
			expect(mockWriteFile).toHaveBeenCalledOnce();
			expect(mockWriteFile).toHaveBeenCalledWith(HOST_PATH, CANONICAL, "utf-8");
		});
	});

	describe("readFile throws a non-ENOENT error", () => {
		it("re-throws the error without swallowing it", async () => {
			const permissionError = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
			permissionError.code = "EACCES";
			mockReadFile.mockRejectedValue(permissionError);

			await expect(compareFile(HOST_PATH, CANONICAL, false)).rejects.toThrow("EACCES");
		});
	});
});
