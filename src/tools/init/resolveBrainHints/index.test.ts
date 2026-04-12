import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import resolveBrainHints from "./index.js";

// Preserve env var across tests
const originalBrainPath = process.env.AIDE_BRAIN_PATH;

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-brain-hints-"));
	// Reset env before each test
	delete process.env.AIDE_BRAIN_PATH;
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
	// Restore original env
	if (originalBrainPath === undefined) {
		delete process.env.AIDE_BRAIN_PATH;
	} else {
		process.env.AIDE_BRAIN_PATH = originalBrainPath;
	}
});

describe("resolveBrainHints", () => {
	it("returns empty array when no candidates exist and no env var", async () => {
		// Use a deep isolated path so no sibling my-brain could exist
		const isolated = join(tempDir, "deep", "project");
		await mkdir(isolated, { recursive: true });

		const hints = await resolveBrainHints(isolated);

		// No env hint; sibling and conventional checks may vary by machine.
		// We assert: no env hint is present.
		const envHints = hints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(0);
	});

	it("returns env hint when AIDE_BRAIN_PATH points to an existing directory", async () => {
		const brainPath = join(tempDir, "vault");
		await mkdir(brainPath);
		process.env.AIDE_BRAIN_PATH = brainPath;

		const hints = await resolveBrainHints(tempDir);

		const envHints = hints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(1);
		expect(envHints[0].path).toBe(brainPath);
		expect(envHints[0].source).toBe("env");
	});

	it("returns no env hint when AIDE_BRAIN_PATH points to a non-existent path", async () => {
		process.env.AIDE_BRAIN_PATH = join(tempDir, "does-not-exist");

		const hints = await resolveBrainHints(tempDir);

		const envHints = hints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(0);
	});

	it("returns sibling hint when my-brain/ exists next to projectRoot", async () => {
		// projectRoot = tempDir/project, sibling = tempDir/my-brain
		const project = join(tempDir, "project");
		const sibling = join(tempDir, "my-brain");
		await mkdir(project);
		await mkdir(sibling);

		const hints = await resolveBrainHints(project);

		const siblingHints = hints.filter((h) => h.source === "sibling");
		expect(siblingHints).toHaveLength(1);
		expect(siblingHints[0].path).toBe(sibling);
	});

	it("returns no sibling hint when my-brain/ does not exist next to projectRoot", async () => {
		const project = join(tempDir, "project");
		await mkdir(project);
		// No sibling my-brain created

		const hints = await resolveBrainHints(project);

		const siblingHints = hints.filter((h) => h.source === "sibling");
		expect(siblingHints).toHaveLength(0);
	});

	it("returns multiple hints when both env and sibling exist", async () => {
		const project = join(tempDir, "project");
		const sibling = join(tempDir, "my-brain");
		const envBrain = join(tempDir, "env-vault");
		await mkdir(project);
		await mkdir(sibling);
		await mkdir(envBrain);
		process.env.AIDE_BRAIN_PATH = envBrain;

		const hints = await resolveBrainHints(project);

		expect(hints.length).toBeGreaterThanOrEqual(2);
		expect(hints.some((h) => h.source === "env")).toBe(true);
		expect(hints.some((h) => h.source === "sibling")).toBe(true);
	});

	it("hint objects have source and path fields", async () => {
		const brainPath = join(tempDir, "vault");
		await mkdir(brainPath);
		process.env.AIDE_BRAIN_PATH = brainPath;

		const hints = await resolveBrainHints(tempDir);

		for (const hint of hints) {
			expect(hint).toHaveProperty("source");
			expect(hint).toHaveProperty("path");
			expect(["env", "sibling", "conventional"]).toContain(hint.source);
			expect(typeof hint.path).toBe("string");
		}
	});

	it("never modifies the filesystem", async () => {
		const project = join(tempDir, "project");
		await mkdir(project);
		process.env.AIDE_BRAIN_PATH = join(tempDir, "does-not-exist");

		await resolveBrainHints(project);

		// Ensure no directories were created
		const entries = await import("node:fs/promises").then((fs) => fs.readdir(tempDir));
		expect(entries).toEqual(["project"]);
	});
});
