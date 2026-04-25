import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import spliceStub from "./index.js";
import { composeStub } from "@/service/install/writeMethodology/index.js";
import { getMethodologyMarker } from "@/service/install/initContent/index.js";

const mockReadFile = readFile as Mock;

const CONFIG_PATH = "/project/CLAUDE.md";
const DOC_HUB_DIR = ".aide";
const MARKER = getMethodologyMarker();
const CANONICAL = composeStub(DOC_HUB_DIR);

beforeEach(() => {
	vi.resetAllMocks();
});

describe("spliceStub", () => {
	describe("config file missing", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
		});

		it("returns status 'missing'", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.status).toBe("missing");
		});

		it("returns category 'pointer-stub'", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.category).toBe("pointer-stub");
		});

		it("includes canonicalContent with stub as sole content", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.canonicalContent).toBe(`${CANONICAL}\n`);
		});

		it("includes filePath", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.filePath).toBe(CONFIG_PATH);
		});
	});

	describe("config file exists, no markers present", () => {
		const EXISTING = "# My Project\n\nExisting content here.\n";

		beforeEach(() => {
			mockReadFile.mockResolvedValue(EXISTING);
		});

		it("returns status 'missing'", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.status).toBe("missing");
		});

		it("canonicalContent appends stub to existing content", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.canonicalContent).toBe(`${EXISTING}\n\n${CANONICAL}\n`);
		});
	});

	describe("config file has markers, stub matches canonical", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(`${CANONICAL}\n`);
		});

		it("returns status 'matches'", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.status).toBe("matches");
		});

		it("does not include canonicalContent", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.canonicalContent).toBeUndefined();
		});
	});

	describe("config file has markers, stub differs from canonical", () => {
		const STALE_BODY = "This is the old methodology pointer text.\n";
		const STALE_STUB = `${MARKER}\n${STALE_BODY}\n${MARKER}`;

		beforeEach(() => {
			mockReadFile.mockResolvedValue(`${STALE_STUB}\n`);
		});

		it("returns status 'differs'", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.status).toBe("differs");
		});

		it("canonicalContent has the canonical stub spliced in", async () => {
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			expect(result.canonicalContent).toBe(`${CANONICAL}\n`);
		});
	});

	describe("splice preserves surrounding content", () => {
		it("keeps content before the opening marker and after the closing marker intact", async () => {
			const BEFORE = "# Preamble\n\nSome existing notes.\n\n";
			const STALE_BODY = "Old stub body.\n";
			const STALE_STUB = `${MARKER}\n${STALE_BODY}\n${MARKER}`;
			const AFTER = "\n\n## Appendix\n\nTrailing content.\n";
			mockReadFile.mockResolvedValue(`${BEFORE}${STALE_STUB}${AFTER}`);

			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);

			expect(result.status).toBe("differs");
			expect(result.canonicalContent).toBe(`${BEFORE}${CANONICAL}${AFTER}`);
			expect(result.canonicalContent).toContain("Some existing notes.");
			expect(result.canonicalContent).toContain("Trailing content.");
		});
	});

	describe("no filesystem writes occur", () => {
		it("never calls writeFile regardless of status", async () => {
			mockReadFile.mockResolvedValue(`${CANONICAL}\n`);
			const result = await spliceStub(CONFIG_PATH, DOC_HUB_DIR);
			// The refactored module only imports readFile — confirmed by type check.
			expect(result.status).toBe("matches");
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});
});
