import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import installSkills from "./index.js";
import type { InitStep } from "@/types/index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeWouldCreate(name: string, content: string): Partial<InitStep> {
	return { status: "would-create", name, category: "skills", content };
}

function makeExists(name: string): Partial<InitStep> {
	return { status: "exists", name, category: "skills" };
}

function makeWouldOverwrite(name: string, content: string): Partial<InitStep> {
	return { status: "would-overwrite", name, category: "skills", content };
}

// ---------------------------------------------------------------------------
// Temp dir lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-skills-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Core behaviour
// ---------------------------------------------------------------------------

describe("installSkills", () => {
	it("returns would-create steps for all skills on a cold run", async () => {
		const skillDir = join(tempDir, "skills");

		const results = await installSkills(skillDir);

		expect(results).toHaveLength(2);
		expect(results.every((r) => r.status === "would-create")).toBe(true);
		expect(results.map((r) => r.name)).toEqual([
			"skills/study-playbook/SKILL.md",
			"skills/brain/SKILL.md",
		]);
	});

	it("would-create steps carry content matching canonical source", async () => {
		const skillDir = join(tempDir, "skills");

		const results = await installSkills(skillDir);

		const studyPlaybook = results.find((r) => r.name === "skills/study-playbook/SKILL.md");
		const canonicalStudyPlaybook = readFileSync(
			join(SKILLS_ROOT, "study-playbook", "SKILL.md"),
			"utf-8",
		);
		expect(studyPlaybook?.content).toBe(canonicalStudyPlaybook);

		const brain = results.find((r) => r.name === "skills/brain/SKILL.md");
		const canonicalBrain = readFileSync(join(SKILLS_ROOT, "brain", "SKILL.md"), "utf-8");
		expect(brain?.content).toBe(canonicalBrain);
	});

	it("returns would-overwrite for a skill that exists on disk with modified content", async () => {
		const skillDir = join(tempDir, "skills");
		await mkdir(join(skillDir, "study-playbook"), { recursive: true });
		await writeFile(
			join(skillDir, "study-playbook", "SKILL.md"),
			"# my custom study-playbook skill\n",
			"utf-8",
		);

		const results = await installSkills(skillDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("skills/study-playbook/SKILL.md")).toBe("would-overwrite");
		expect(byName.get("skills/brain/SKILL.md")).toBe("would-create");
	});

	it("would-overwrite step carries canonical content", async () => {
		const skillDir = join(tempDir, "skills");
		await mkdir(join(skillDir, "study-playbook"), { recursive: true });
		await writeFile(
			join(skillDir, "study-playbook", "SKILL.md"),
			"# stale skill content\n",
			"utf-8",
		);

		const results = await installSkills(skillDir);

		const step = results.find((r) => r.name === "skills/study-playbook/SKILL.md");
		const canonical = readFileSync(join(SKILLS_ROOT, "study-playbook", "SKILL.md"), "utf-8");
		expect(step?.status).toBe("would-overwrite");
		expect(step?.content).toBe(canonical);
	});

	it("returns exists when a skill on disk is byte-identical to canonical", async () => {
		const skillDir = join(tempDir, "skills");
		await mkdir(join(skillDir, "study-playbook"), { recursive: true });

		const canonicalContent = readFileSync(
			join(SKILLS_ROOT, "study-playbook", "SKILL.md"),
			"utf-8",
		);
		await writeFile(join(skillDir, "study-playbook", "SKILL.md"), canonicalContent, "utf-8");

		const results = await installSkills(skillDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("skills/study-playbook/SKILL.md")).toBe("exists");
		expect(byName.get("skills/brain/SKILL.md")).toBe("would-create");
	});

	it("exists steps have no content field", async () => {
		const skillDir = join(tempDir, "skills");
		await mkdir(join(skillDir, "study-playbook"), { recursive: true });

		const canonicalContent = readFileSync(
			join(SKILLS_ROOT, "study-playbook", "SKILL.md"),
			"utf-8",
		);
		await writeFile(join(skillDir, "study-playbook", "SKILL.md"), canonicalContent, "utf-8");

		const results = await installSkills(skillDir);

		const step = results.find((r) => r.name === "skills/study-playbook/SKILL.md");
		expect(step?.status).toBe("exists");
		expect(step?.content).toBeUndefined();
	});

	it("category is 'skills' for all steps", async () => {
		const skillDir = join(tempDir, "skills");

		const results = await installSkills(skillDir);

		expect(results.every((r) => r.category === "skills")).toBe(true);
	});

	it("never writes to disk", async () => {
		const skillDir = join(tempDir, "skills");

		await installSkills(skillDir);

		await expect(access(skillDir)).rejects.toThrow();
	});

	it("does not cascade when one canonical read fails — returns would-skip for that entry", async () => {
		const skillDir = join(tempDir, "skills");
		const failingCanonical = "skills/study-playbook";

		vi.resetModules();
		vi.doMock("@/service/install/initContent/index.js", async () => {
			const actual = await vi.importActual<typeof import("@/service/install/initContent/index.js")>(
				"@/service/install/initContent/index.js",
			);
			return {
				...actual,
				readCanonicalDoc: (name: string) => {
					if (name === failingCanonical) {
						throw new Error(`initContent: canonical doc "${name}" not readable`);
					}
					return `mocked content for ${name}\n`;
				},
			};
		});

		const { default: installSkillsFresh } = await import("./index.js");
		const results = await installSkillsFresh(skillDir);

		expect(results).toHaveLength(2);
		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("skills/study-playbook/SKILL.md")).toBe("would-skip");
		expect(byName.get("skills/brain/SKILL.md")).toBe("would-create");

		vi.doUnmock("@/service/install/initContent/index.js");
		vi.resetModules();
	});
});

// ---------------------------------------------------------------------------
// Parameterized: all three outcome shapes
// ---------------------------------------------------------------------------

describe("installSkills — parameterized outcome shapes", () => {
	it.each([
		["skills/study-playbook/SKILL.md", "study-playbook/SKILL.md"] as const,
		["skills/brain/SKILL.md", "brain/SKILL.md"] as const,
	])("missing %s → would-create with content", async (displayName, relPath) => {
		const skillDir = join(tempDir, "skills");

		const results = await installSkills(skillDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(SKILLS_ROOT, relPath), "utf-8");
		expect(step).toMatchObject(makeWouldCreate(displayName, canonical));
	});

	it.each([
		["skills/study-playbook/SKILL.md", "study-playbook/SKILL.md"] as const,
		["skills/brain/SKILL.md", "brain/SKILL.md"] as const,
	])("byte-identical %s on disk → exists with no content", async (displayName, relPath) => {
		const skillDir = join(tempDir, "skills");
		const dirPath = join(skillDir, relPath.split("/")[0]!);
		await mkdir(dirPath, { recursive: true });

		const canonicalContent = readFileSync(join(SKILLS_ROOT, relPath), "utf-8");
		await writeFile(join(skillDir, relPath), canonicalContent, "utf-8");

		const results = await installSkills(skillDir);
		const step = results.find((r) => r.name === displayName)!;

		expect(step).toMatchObject(makeExists(displayName));
		expect(step.content).toBeUndefined();
	});

	it.each([
		["skills/study-playbook/SKILL.md", "study-playbook/SKILL.md"] as const,
		["skills/brain/SKILL.md", "brain/SKILL.md"] as const,
	])("drifted %s on disk → would-overwrite with canonical content", async (displayName, relPath) => {
		const skillDir = join(tempDir, "skills");
		const dirPath = join(skillDir, relPath.split("/")[0]!);
		await mkdir(dirPath, { recursive: true });
		await writeFile(
			join(skillDir, relPath),
			`# stale content for ${displayName}\n`,
			"utf-8",
		);

		const results = await installSkills(skillDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(SKILLS_ROOT, relPath), "utf-8");
		expect(step).toMatchObject(makeWouldOverwrite(displayName, canonical));
	});
});
