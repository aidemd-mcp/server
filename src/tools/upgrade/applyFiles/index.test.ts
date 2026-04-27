import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UpgradeFileResult } from "@/types/index.js";

// ── Module mock — intercept all fs/promises I/O ───────────────────────────────
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile } from "node:fs/promises";
import applyFiles from "./index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<UpgradeFileResult>): UpgradeFileResult {
	return {
		name: "test-file.md",
		filePath: "/project/.aide/docs/test-file.md",
		status: "differs",
		category: "methodology-docs",
		canonicalContent: "canonical content here",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applyFiles", () => {
	// ── Regular file: differs → updated ──────────────────────────────────────
	it("writes to disk and returns status: updated for a differs file", async () => {
		const file = makeFile({ status: "differs" });
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
			file.filePath,
			"canonical content here",
			"utf-8",
		);
		expect(result.status).toBe("updated");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── Regular file: missing → created ──────────────────────────────────────
	it("creates parent dirs and returns status: created for a missing file", async () => {
		const file = makeFile({
			status: "missing",
			filePath: "/project/.aide/docs/deep/nested/file.md",
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
			"/project/.aide/docs/deep/nested",
			{ recursive: true },
		);
		expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
			file.filePath,
			"canonical content here",
			"utf-8",
		);
		expect(result.status).toBe("created");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── matches: remapped to unchanged in apply output ───────────────────────
	it("remaps a matches file to status: unchanged with no disk write", async () => {
		const file = makeFile({ status: "matches", canonicalContent: undefined });
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("unchanged");
	});

	// ── MCP file: differs → pass through unchanged ────────────────────────────
	it("passes through an mcp differs file unchanged with prescription intact", async () => {
		const prescription = { key: "aide", entry: { command: "npx", args: ["@aidemd-mcp/server"] } };
		const file = makeFile({
			status: "differs",
			category: "mcp",
			prescription,
			canonicalContent: undefined,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.prescription).toEqual(prescription);
		expect(result.status).toBe("differs");
	});

	// ── MCP file: missing → pass through unchanged ────────────────────────────
	it("passes through an mcp missing file unchanged", async () => {
		const prescription = { key: "aide", entry: { command: "npx", args: ["@aidemd-mcp/server"] } };
		const file = makeFile({
			status: "missing",
			category: "mcp",
			prescription,
			canonicalContent: "{}",
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("missing");
		expect(result.prescription).toEqual(prescription);
	});

	// ── MCP file: malformed → pass through unchanged ──────────────────────────
	it("passes through an mcp malformed file unchanged", async () => {
		const file = makeFile({
			status: "malformed",
			category: "mcp",
			canonicalContent: undefined,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("malformed");
	});

	// ── IDE VS Code: differs → pass through with instructions ─────────────────
	it("passes through IDE VS Code differs file with instructions field added", async () => {
		const file = makeFile({
			name: "VS Code extension",
			status: "differs",
			category: "ide",
			filePath: "/path/to/aide-markdown-0.0.1.vsix",
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.instructions).toBe(
			"code --install-extension /path/to/aide-markdown-0.0.1.vsix",
		);
		// Status stays as differs (not updated) — agent runs the instruction
		expect(result.status).toBe("differs");
	});

	// ── IDE Zed: differs → write to disk ─────────────────────────────────────
	it("writes Zed config to disk and returns status: updated", async () => {
		const file = makeFile({
			name: "Zed settings",
			status: "differs",
			category: "ide",
			filePath: "/project/.zed/settings.json",
			canonicalContent: '{"file_associations":{}}',
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
			"/project/.zed/settings.json",
			'{"file_associations":{}}',
			"utf-8",
		);
		expect(result.status).toBe("updated");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── IDE Zed: missing → create file ───────────────────────────────────────
	it("creates missing Zed config and returns status: created", async () => {
		const file = makeFile({
			name: "Zed settings",
			status: "missing",
			category: "ide",
			filePath: "/project/.zed/settings.json",
			canonicalContent: '{"file_associations":{}}',
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
			"/project/.zed/settings.json",
			'{"file_associations":{}}',
			"utf-8",
		);
		expect(result.status).toBe("created");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── Pointer-stub: differs → write spliced content ─────────────────────────
	it("writes pointer-stub canonicalContent to disk and returns status: updated", async () => {
		const splicedContent = "# AIDE Pointer\n\n<!-- AIDE:START -->\nstub\n<!-- AIDE:END -->\n\nUser content here";
		const file = makeFile({
			name: "Methodology pointer",
			status: "differs",
			category: "pointer-stub",
			filePath: "/project/CLAUDE.md",
			canonicalContent: splicedContent,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
			"/project/CLAUDE.md",
			splicedContent,
			"utf-8",
		);
		expect(result.status).toBe("updated");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── Brain: missing → instructions, no disk write ─────────────────────────
	it("passes through brain-category missing file with instructions, no disk write", async () => {
		const file = makeFile({
			name: ".aide/config/brain.aide",
			filePath: "/some/.aide/config/brain.aide",
			status: "missing",
			category: "brain",
			canonicalContent: undefined,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.instructions).toBe("Run /aide:brain config to set up the brain.");
		expect(result.status).toBe("missing");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── Brain: malformed → instructions, no disk write ────────────────────────
	it("passes through brain-category malformed file with instructions, no disk write", async () => {
		const file = makeFile({
			name: ".aide/config/brain.aide",
			filePath: "/some/.aide/config/brain.aide",
			status: "malformed",
			category: "brain",
			canonicalContent: undefined,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.instructions).toBe("Run /aide:brain config to set up the brain.");
		expect(result.status).toBe("malformed");
		expect(result.canonicalContent).toBeUndefined();
	});

	// ── Brain: matches → unchanged, no instructions ───────────────────────────
	it("brain-category matches file becomes unchanged with no instructions", async () => {
		const file = makeFile({
			name: ".aide/config/brain.aide",
			filePath: "/some/.aide/config/brain.aide",
			status: "matches",
			category: "brain",
			canonicalContent: undefined,
		});
		const [result] = await applyFiles([file]);

		expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("unchanged");
		expect(result.instructions).toBeUndefined();
	});

	// ── Idempotency: already updated passes through ───────────────────────────
	it("passes through an already-updated file unchanged", async () => {
		const file = makeFile({ status: "updated", canonicalContent: undefined });
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("updated");
	});

	// ── Idempotency: already created passes through ───────────────────────────
	it("passes through an already-created file unchanged", async () => {
		const file = makeFile({ status: "created", canonicalContent: undefined });
		const [result] = await applyFiles([file]);

		expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
		expect(result.status).toBe("created");
	});

	// ── Batch processing ──────────────────────────────────────────────────────
	it("processes multiple files independently", async () => {
		const files = [
			makeFile({ status: "differs", filePath: "/project/.aide/docs/a.md", canonicalContent: "content-a" }),
			makeFile({ status: "matches", filePath: "/project/.aide/docs/b.md", canonicalContent: undefined }),
			makeFile({ status: "missing", filePath: "/project/.aide/docs/c.md", canonicalContent: "content-c" }),
		];
		const results = await applyFiles(files);

		expect(results[0].status).toBe("updated");
		expect(results[1].status).toBe("unchanged");
		expect(results[2].status).toBe("created");
		expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(2);
	});
});
