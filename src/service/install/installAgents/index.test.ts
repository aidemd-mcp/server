import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import installAgents from "./index.js";
import type { InitStep } from "@/types/index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const CANONICAL_AGENTS_ROOT = join(REPO_ROOT, ".claude", "agents");
const AGENTS_ROOT = join(CANONICAL_AGENTS_ROOT, "aide");

const AGENT_FILES = [
	"aide/aide-spec-writer.md",
	"aide/aide-domain-expert.md",
	"aide/aide-strategist.md",
	"aide/aide-architect.md",
	"aide/aide-implementor.md",
	"aide/aide-qa.md",
	"aide/aide-auditor.md",
	"aide/aide-aligner.md",
	"aide/aide-explorer.md",
	"aide/aide-maintainer.md",
	"kanban/kanban-maintainer.md",
];

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeWouldCreate(name: string, content: string): Partial<InitStep> {
	return { status: "would-create", name, category: "agents", content };
}

function makeExists(name: string): Partial<InitStep> {
	return { status: "exists", name, category: "agents" };
}

function makeWouldOverwrite(name: string, content: string): Partial<InitStep> {
	return { status: "would-overwrite", name, category: "agents", content };
}

// ---------------------------------------------------------------------------
// Temp dir lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-agents-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Core behaviour
// ---------------------------------------------------------------------------

describe("installAgents", () => {
	it("returns would-create steps for all agents on a cold run", async () => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);

		expect(results).toHaveLength(AGENT_FILES.length);
		expect(results.every((r) => r.status === "would-create")).toBe(true);
		expect(results.map((r) => r.name)).toEqual(
			AGENT_FILES.map((f) => `agents/${f}`),
		);
	});

	it("would-create steps carry content matching canonical source", async () => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);

		for (const result of results) {
			const relativePath = result.name.replace(/^agents\//, "");
			const canonical = readFileSync(join(CANONICAL_AGENTS_ROOT, relativePath), "utf-8");
			expect(result.content).toBe(canonical);
		}
	});

	it("returns would-overwrite for an agent that exists on disk with modified content", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });
		await writeFile(
			join(agentDir, "aide", "aide-architect.md"),
			"# my custom architect\n",
			"utf-8",
		);

		const results = await installAgents(agentDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("agents/aide/aide-architect.md")).toBe("would-overwrite");
		expect(byName.get("agents/aide/aide-spec-writer.md")).toBe("would-create");
		expect(byName.get("agents/aide/aide-implementor.md")).toBe("would-create");
	});

	it("would-overwrite step carries canonical content", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });
		await writeFile(
			join(agentDir, "aide", "aide-architect.md"),
			"# stale architect content\n",
			"utf-8",
		);

		const results = await installAgents(agentDir);

		const step = results.find((r) => r.name === "agents/aide/aide-architect.md");
		const canonical = readFileSync(join(AGENTS_ROOT, "aide-architect.md"), "utf-8");
		expect(step?.status).toBe("would-overwrite");
		expect(step?.content).toBe(canonical);
	});

	it("returns exists when an agent on disk is byte-identical to canonical", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });

		const canonicalContent = readFileSync(join(AGENTS_ROOT, "aide-architect.md"), "utf-8");
		await writeFile(join(agentDir, "aide", "aide-architect.md"), canonicalContent, "utf-8");

		const results = await installAgents(agentDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("agents/aide/aide-architect.md")).toBe("exists");
		expect(byName.get("agents/aide/aide-spec-writer.md")).toBe("would-create");
		expect(byName.get("agents/aide/aide-implementor.md")).toBe("would-create");
	});

	it("exists steps have no content field", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });

		const canonicalContent = readFileSync(join(AGENTS_ROOT, "aide-architect.md"), "utf-8");
		await writeFile(join(agentDir, "aide", "aide-architect.md"), canonicalContent, "utf-8");

		const results = await installAgents(agentDir);

		const step = results.find((r) => r.name === "agents/aide/aide-architect.md");
		expect(step?.status).toBe("exists");
		expect(step?.content).toBeUndefined();
	});

	it("category is 'agents' for all steps", async () => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);

		expect(results.every((r) => r.category === "agents")).toBe(true);
	});

	it("never writes to disk", async () => {
		const agentDir = join(tempDir, "agents");

		await installAgents(agentDir);

		await expect(access(agentDir)).rejects.toThrow();
	});

	it("does not cascade when one canonical read fails — returns would-skip for that entry", async () => {
		const agentDir = join(tempDir, "agents");
		const failingCanonical = "agents/aide/aide-architect";

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

		const { default: installAgentsFresh } = await import("./index.js");
		const results = await installAgentsFresh(agentDir);

		expect(results).toHaveLength(AGENT_FILES.length);
		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("agents/aide/aide-architect.md")).toBe("would-skip");
		expect(byName.get("agents/aide/aide-spec-writer.md")).toBe("would-create");
		expect(byName.get("agents/aide/aide-implementor.md")).toBe("would-create");

		vi.doUnmock("@/service/install/initContent/index.js");
		vi.resetModules();
	});
});

// ---------------------------------------------------------------------------
// Parameterized: all three outcome shapes
// ---------------------------------------------------------------------------

describe("installAgents — parameterized outcome shapes", () => {
	it.each([
		["agents/aide/aide-spec-writer.md", "aide-spec-writer.md"] as const,
		["agents/aide/aide-architect.md", "aide-architect.md"] as const,
		["agents/aide/aide-implementor.md", "aide-implementor.md"] as const,
	])("missing %s → would-create with content", async (displayName, filename) => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(AGENTS_ROOT, filename), "utf-8");
		expect(step).toMatchObject(makeWouldCreate(displayName, canonical));
	});

	it.each([
		["agents/aide/aide-spec-writer.md", "aide-spec-writer.md"] as const,
		["agents/aide/aide-architect.md", "aide-architect.md"] as const,
		["agents/aide/aide-implementor.md", "aide-implementor.md"] as const,
	])("byte-identical %s on disk → exists with no content", async (displayName, filename) => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });

		const canonicalContent = readFileSync(join(AGENTS_ROOT, filename), "utf-8");
		await writeFile(join(agentDir, "aide", filename), canonicalContent, "utf-8");

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === displayName)!;

		expect(step).toMatchObject(makeExists(displayName));
		expect(step.content).toBeUndefined();
	});

	it.each([
		["agents/aide/aide-spec-writer.md", "aide-spec-writer.md"] as const,
		["agents/aide/aide-architect.md", "aide-architect.md"] as const,
		["agents/aide/aide-implementor.md", "aide-implementor.md"] as const,
	])("drifted %s on disk → would-overwrite with canonical content", async (displayName, filename) => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "aide"), { recursive: true });
		await writeFile(
			join(agentDir, "aide", filename),
			`# stale content for ${displayName}\n`,
			"utf-8",
		);

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(AGENTS_ROOT, filename), "utf-8");
		expect(step).toMatchObject(makeWouldOverwrite(displayName, canonical));
	});
});

// ---------------------------------------------------------------------------
// Kanban board agent (lands outside the aide/ subfolder)
// ---------------------------------------------------------------------------

describe("installAgents — kanban board agent", () => {
	const BOARD_NAME = "agents/kanban/kanban-maintainer.md";
	const canonicalBoardAgent = () =>
		readFileSync(join(CANONICAL_AGENTS_ROOT, "kanban", "kanban-maintainer.md"), "utf-8");

	it("cold run reports would-create with canonical content at the kanban subfolder", async () => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === BOARD_NAME)!;

		expect(step.status).toBe("would-create");
		expect(step.category).toBe("agents");
		expect(step.filePath).toBe(join(agentDir, "kanban", "kanban-maintainer.md"));
		expect(step.content).toBe(canonicalBoardAgent());
	});

	it("never lands inside the aide subfolder", async () => {
		const agentDir = join(tempDir, "agents");

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === BOARD_NAME)!;

		expect(step.filePath?.startsWith(join(agentDir, "aide"))).toBe(false);
	});

	it("byte-identical file on disk → exists with no content", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "kanban"), { recursive: true });
		await writeFile(join(agentDir, "kanban", "kanban-maintainer.md"), canonicalBoardAgent(), "utf-8");

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === BOARD_NAME)!;

		expect(step).toMatchObject(makeExists(BOARD_NAME));
		expect(step.content).toBeUndefined();
	});

	it("host-customized file on disk → would-overwrite with canonical content", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "kanban"), { recursive: true });
		await writeFile(
			join(agentDir, "kanban", "kanban-maintainer.md"),
			"# my customized board agent\n",
			"utf-8",
		);

		const results = await installAgents(agentDir);
		const step = results.find((r) => r.name === BOARD_NAME)!;

		expect(step).toMatchObject(makeWouldOverwrite(BOARD_NAME, canonicalBoardAgent()));
	});

	it("other agents are unaffected when only the board agent is present", async () => {
		const agentDir = join(tempDir, "agents");
		await mkdir(join(agentDir, "kanban"), { recursive: true });
		await writeFile(join(agentDir, "kanban", "kanban-maintainer.md"), canonicalBoardAgent(), "utf-8");

		const results = await installAgents(agentDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("agents/aide/aide-architect.md")).toBe("would-create");
	});
});
