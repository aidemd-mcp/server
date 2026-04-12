import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import spliceStub from "./index.js";
import { composeStub } from "@/tools/init/writeMethodology/index.js";
import { getMethodologyMarker } from "@/tools/init/initContent/index.js";

const mockReadFile = readFile as Mock;
const mockWriteFile = writeFile as Mock;
const mockMkdir = mkdir as Mock;

const CONFIG_PATH = "/project/CLAUDE.md";
const DOC_HUB_DIR = ".aide";
const MARKER = getMethodologyMarker();
const CANONICAL = composeStub(DOC_HUB_DIR);

beforeEach(() => {
	vi.resetAllMocks();
	mockWriteFile.mockResolvedValue(undefined);
	mockMkdir.mockResolvedValue(undefined);
});

describe("spliceStub", () => {
	describe("config file missing", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
		});

		it("returns 'would create' when write=false", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(result).toEqual({ name: "Methodology pointer", status: "would create" });
		});

		it("does not call writeFile or mkdir when write=false", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(mockWriteFile).not.toHaveBeenCalled();
			expect(mockMkdir).not.toHaveBeenCalled();
		});

		it("returns 'created' when write=true", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(result).toEqual({ name: "Methodology pointer", status: "created" });
		});

		it("calls mkdir with the parent dir and recursive=true when write=true", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(mockMkdir).toHaveBeenCalledOnce();
			expect(mockMkdir).toHaveBeenCalledWith("/project", { recursive: true });
		});

		it("calls writeFile with the stub as sole content when write=true", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(mockWriteFile).toHaveBeenCalledOnce();
			expect(mockWriteFile).toHaveBeenCalledWith(CONFIG_PATH, `${CANONICAL}\n`, "utf-8");
		});
	});

	describe("config file exists, no markers present", () => {
		const EXISTING = "# My Project\n\nExisting content here.\n";

		beforeEach(() => {
			mockReadFile.mockResolvedValue(EXISTING);
		});

		it("returns 'would create' when write=false", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(result).toEqual({ name: "Methodology pointer", status: "would create" });
		});

		it("does not call writeFile when write=false", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(mockWriteFile).not.toHaveBeenCalled();
		});

		it("returns 'created' when write=true", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(result).toEqual({ name: "Methodology pointer", status: "created" });
		});

		it("appends stub to existing content when write=true", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(mockWriteFile).toHaveBeenCalledOnce();
			expect(mockWriteFile).toHaveBeenCalledWith(
				CONFIG_PATH,
				`${EXISTING}\n\n${CANONICAL}\n`,
				"utf-8",
			);
		});
	});

	describe("config file has markers, stub matches canonical", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(`${CANONICAL}\n`);
		});

		it("returns 'unchanged' when write=false", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(result).toEqual({ name: "Methodology pointer", status: "unchanged" });
		});

		it("returns 'unchanged' when write=true", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(result).toEqual({ name: "Methodology pointer", status: "unchanged" });
		});

		it("does not call writeFile regardless of write flag", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(mockWriteFile).not.toHaveBeenCalled();
		});
	});

	describe("config file has markers, stub differs from canonical", () => {
		const STALE_BODY = "This is the old methodology pointer text.\n";
		const STALE_STUB = `${MARKER}\n${STALE_BODY}\n${MARKER}`;

		beforeEach(() => {
			mockReadFile.mockResolvedValue(`${STALE_STUB}\n`);
		});

		it("returns 'would update' when write=false", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(result).toEqual({ name: "Methodology pointer", status: "would update" });
		});

		it("does not call writeFile when write=false", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, false);
			expect(mockWriteFile).not.toHaveBeenCalled();
		});

		it("returns 'updated' when write=true", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(result).toEqual({ name: "Methodology pointer", status: "updated" });
		});

		it("writes the canonical stub in place of the stale region when write=true", async () => {
			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);
			expect(mockWriteFile).toHaveBeenCalledOnce();
			expect(mockWriteFile).toHaveBeenCalledWith(CONFIG_PATH, `${CANONICAL}\n`, "utf-8");
		});
	});

	describe("splice preserves surrounding content", () => {
		it("keeps content before the opening marker and after the closing marker intact", async () => {
			const BEFORE = "# Preamble\n\nSome existing notes.\n\n";
			const STALE_BODY = "Old stub body.\n";
			const STALE_STUB = `${MARKER}\n${STALE_BODY}\n${MARKER}`;
			const AFTER = "\n\n## Appendix\n\nTrailing content.\n";
			mockReadFile.mockResolvedValue(`${BEFORE}${STALE_STUB}${AFTER}`);

			await spliceStub(CONFIG_PATH, DOC_HUB_DIR, true);

			expect(mockWriteFile).toHaveBeenCalledOnce();
			const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
			expect(writtenContent).toBe(`${BEFORE}${CANONICAL}${AFTER}`);
			expect(writtenContent).toContain("Some existing notes.");
			expect(writtenContent).toContain("Trailing content.");
		});
	});
});
