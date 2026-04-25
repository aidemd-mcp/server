import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import writeMethodology, { composeStub } from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const METHODOLOGY_ROOT = join(REPO_ROOT, ".aide", "docs");

const HUB_DIR = ".aide";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-methodology-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeMethodology", () => {
	it("returns would-create step when config file does not exist", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("methodology");
		expect(result.name).toBe("Methodology pointer");
	});

	it("would-create content contains the marker and hub path", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.content).toContain("<!-- aide-methodology -->");
		expect(result.content).toContain(`${HUB_DIR}/index.md`);
	});

	it("would-create content has no unsubstituted placeholders", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.content).not.toContain("{{HUB_PATH}}");
	});

	it("would-create content includes existing file content before stub", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const existing = "# My Project\n\nExisting content here.\n";
		await writeFile(configPath, existing, "utf-8");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.status).toBe("would-create");
		expect(result.content).toContain("Existing content here.");
		expect(result.content).toContain("<!-- aide-methodology -->");
	});

	it("returns exists when marker is already present with identical stub body", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const canonical = composeStub(HUB_DIR);
		await writeFile(configPath, `# Preamble\n\n${canonical}\n`, "utf-8");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.status).toBe("exists");
		expect(result.content).toBeUndefined();
	});

	it("returns would-overwrite when marker is present but stub body has drifted", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const canonical = composeStub(HUB_DIR);
		const drifted = canonical.replace("AIDE — Autonomous Intent-Driven Engineering", "AIDE — Old Name");
		const preamble = "# My Project\n\nSome content.\n\n";
		await writeFile(configPath, `${preamble}${drifted}\n`, "utf-8");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.status).toBe("would-overwrite");
		expect(result.content).toBeDefined();
		// The drifted heading must be gone
		expect(result.content).not.toContain("AIDE — Old Name");
		// The canonical heading must be present
		expect(result.content).toContain("AIDE — Autonomous Intent-Driven Engineering");
		// Preamble must be preserved
		expect(result.content).toContain("Some content.");
	});

	it("would-overwrite content has the drifted block replaced in-place", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const canonical = composeStub(HUB_DIR);
		const drifted = canonical.replace("aide_upgrade", "aide_update_STALE");
		const trailer = "\n\n# Trailer section\n";
		await writeFile(configPath, `${drifted}${trailer}`, "utf-8");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.status).toBe("would-overwrite");
		// Trailer must be preserved after the stub
		expect(result.content).toContain("# Trailer section");
		// Stale text must be gone
		expect(result.content).not.toContain("aide_update_STALE");
		// Canonical stub must be there
		expect(result.content).toContain(canonical);
	});

	it("does not ship the full canonical methodology body in content", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		const canonicalSpec = readFileSync(join(METHODOLOGY_ROOT, "aide-spec.md"), "utf-8");
		const distinctive = canonicalSpec
			.split("\n")
			.find(
				(line) =>
					line.length > 60 &&
					line.includes("progressive") === false &&
					line.includes("AIDE") === false,
			);
		expect(distinctive).toBeTruthy();
		if (distinctive) expect(result.content).not.toContain(distinctive);
	});

	it("never writes to disk", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		await writeMethodology(configPath, HUB_DIR);

		await expect(import("node:fs/promises").then((fs) => fs.readFile(configPath, "utf-8"))).rejects.toThrow();
	});

	it("filePath matches configPath", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.filePath).toBe(configPath);
	});

	it("never reintroduces the stale 'Intel-Driven' wording", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result.content).not.toContain("Intel-Driven");
	});
});
