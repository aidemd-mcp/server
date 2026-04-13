import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import buildAncestorChain from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-ancestor-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("buildAncestorChain", () => {
	it("returns empty string when target equals root (no ancestors)", async () => {
		const result = await buildAncestorChain(tempDir, tempDir);
		expect(result).toBe("");
	});

	it("returns single ancestor when root has .aide/intent.aide and target is one level deep", async () => {
		// Root-level spec at .aide/intent.aide
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Root project intent\n---\n",
		);

		// Target is one level deep
		await mkdir(join(tempDir, "src"), { recursive: true });
		const target = join(tempDir, "src");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");
		expect(result).toContain(".aide/intent.aide");
		expect(result).toContain("Root project intent");
	});

	it("returns multi-level chain rendered root-first, target-parent-last", async () => {
		// Root spec
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Root intent\n---\n",
		);

		// Intermediate level
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", ".aide"),
			"---\ndescription: Src intent\n---\n",
		);

		// Target is two levels deep
		await mkdir(join(tempDir, "src", "tools"), { recursive: true });
		const target = join(tempDir, "src", "tools");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");

		const rootIndex = result.indexOf(".aide/intent.aide");
		const srcIndex = result.indexOf("src/.aide");
		expect(rootIndex).toBeGreaterThanOrEqual(0);
		expect(srcIndex).toBeGreaterThanOrEqual(0);
		// Root must appear before src
		expect(rootIndex).toBeLessThan(srcIndex);
	});

	it("includes description in output when present in frontmatter", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: A meaningful description\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("A meaningful description");
		expect(result).toContain(" — A meaningful description");
	});

	it("omits em-dash when description field is absent", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\nscope: some-scope\nintent: Some intent\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");
		expect(result).not.toContain(" — ");
	});

	it("shows [aligned] badge after description when status is aligned", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Aligned spec\nstatus: aligned\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("[aligned]");
		expect(result).toContain("Aligned spec [aligned]");
	});

	it("shows [misaligned] badge after description when status is misaligned", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Drifted spec\nstatus: misaligned\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("[misaligned]");
		expect(result).toContain("Drifted spec [misaligned]");
	});

	it("shows [misaligned] badge even when description is absent", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\nscope: some-scope\nstatus: misaligned\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");
		expect(result).toContain("[misaligned]");
		// No em-dash since description is absent
		expect(result).not.toContain(" — ");
	});

	it("does not show any badge when status is absent", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: No status here\n---\n",
		);

		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).not.toContain("[pending]");
		expect(result).not.toContain("[aligned]");
		expect(result).not.toContain("[misaligned]");
	});

	it("finds root spec at .aide/intent.aide per the canonical root-level path", async () => {
		// Verify the walker specifically handles .aide/intent.aide at root
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Canonical root spec\n---\n",
		);

		await mkdir(join(tempDir, "deeply", "nested", "path"), { recursive: true });
		const target = join(tempDir, "deeply", "nested", "path");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");
		expect(result).toContain(".aide/intent.aide");
		expect(result).toContain("Canonical root spec");
	});

	it("returns empty string when no spec files exist anywhere in the chain", async () => {
		await mkdir(join(tempDir, "sub"), { recursive: true });
		const target = join(tempDir, "sub");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toBe("");
	});

	it("falls back to intent.aide at non-root directories when .aide is absent", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "intent.aide"),
			"---\ndescription: Src via intent.aide\n---\n",
		);

		await mkdir(join(tempDir, "src", "tools"), { recursive: true });
		const target = join(tempDir, "src", "tools");

		const result = await buildAncestorChain(tempDir, target);

		expect(result).toContain("Ancestor chain:");
		expect(result).toContain("src/intent.aide");
		expect(result).toContain("Src via intent.aide");
	});
});
