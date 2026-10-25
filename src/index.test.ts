import { describe, it, expect, vi, afterEach } from "vitest";
import type { CleanupResult } from "@/types/index.js";

// Registered request handlers keyed by their (mocked) schema object. A map, not
// mock.calls, so afterEach(vi.clearAllMocks) cannot erase the capture.
const { handlers, mockCleanup, mockScaffold, mockFrontmatter, mockBrainCategory, mockUpgrade, mockBrain, mockReadTemplateSection, mockListContract, mockValidateDraft } =
	vi.hoisted(() => ({
		handlers: new Map<unknown, (request?: unknown) => Promise<any>>(),
		mockCleanup: vi.fn(),
		mockScaffold: vi.fn(),
		mockFrontmatter: vi.fn(),
		mockBrainCategory: vi.fn(),
		mockUpgrade: vi.fn(),
		mockBrain: vi.fn(),
		mockReadTemplateSection: vi.fn(),
		mockListContract: vi.fn(),
		mockValidateDraft: vi.fn(),
	}));

// Mock the init CLI module so routeSubcommand never runs a real install.
const { mockRunInitCli } = vi.hoisted(() => ({ mockRunInitCli: vi.fn() }));
vi.mock("./cli/init/index.js", () => ({ runInitCli: mockRunInitCli }));

// Mock MCP SDK modules to prevent real server instantiation.
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
	Server: vi.fn().mockImplementation(() => ({
		setRequestHandler: vi.fn((schema: unknown, handler: (request?: unknown) => Promise<any>) => {
			handlers.set(schema, handler);
		}),
		connect: vi.fn().mockResolvedValue(undefined),
	})),
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
	StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolRequestSchema: { id: "call" },
	ListToolsRequestSchema: { id: "list" },
}));

// Keep the real CleanupInput (zod) so parsing and defaults are exercised; stub the work.
vi.mock("@/tools/cleanup/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/tools/cleanup/index.js")>();
	return { ...original, default: mockCleanup };
});

// Keep the real ScaffoldInput (zod) so the type enum is exercised; stub the work (the real scaffold writes into the cwd).
vi.mock("@/tools/scaffold/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/tools/scaffold/index.js")>();
	return { ...original, default: mockScaffold };
});

// Keep the real FrontmatterInput (zod) and formatResult so parsing and report text are exercised; stub the work.
vi.mock("@/tools/frontmatter/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/tools/frontmatter/index.js")>();
	return { ...original, default: mockFrontmatter };
});

// Stub the brain category orchestrator; the handler's routing is what is under test.
vi.mock("@/tools/upgrade/brainCategory/index.js", () => ({ default: mockBrainCategory }));

// Keep the real UpgradeInput (zod) so the category / brainChange / beforeHash rules are exercised; stub the work.
vi.mock("@/tools/upgrade/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/tools/upgrade/index.js")>();
	return { ...original, default: mockUpgrade };
});

// Keep the real BrainInput (zod) so the cross-field rules are exercised; stub the host read.
vi.mock("@/tools/brain/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/tools/brain/index.js")>();
	return { ...original, default: mockBrain };
});

// Stub the three non-host mode helpers; the handler's routing is what is under test.
vi.mock("@/tools/brain/readTemplateSection/index.js", () => ({ default: mockReadTemplateSection }));
vi.mock("@/tools/brain/listContract/index.js", () => ({ default: mockListContract }));
vi.mock("@/tools/brain/validateDraft/index.js", () => ({ default: mockValidateDraft }));

// Import the exported function under test after mocks are declared.
import { routeSubcommand } from "./index.js";
import { BrainInput } from "@/tools/brain/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import brainContract from "@/service/brainContract/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";

const originalArgv = process.argv;

afterEach(() => {
	process.argv = originalArgv;
	vi.clearAllMocks();
});

describe("routeSubcommand", () => {
	it("dynamically imports ./cli/init/index.js, runs runInitCli and returns true when argv[2] is 'init'", async () => {
		process.argv = ["node", "dist/index.js", "init"];

		const handled = await routeSubcommand();

		expect(handled).toBe(true);
		expect(mockRunInitCli).toHaveBeenCalledTimes(1);
	});

	it("returns false and does not import the init module when argv[2] is not 'init'", async () => {
		process.argv = ["node", "dist/index.js", "--root", "/some/path"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});

	it("returns false when process.argv has no positional arguments", async () => {
		process.argv = ["node", "dist/index.js"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});

	it("returns false when argv[2] is a different subcommand", async () => {
		process.argv = ["node", "dist/index.js", "upgrade"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});
});

describe("remediation names the project's own launcher", () => {
	const NPX_ONLY_REMEDIATION = /run `npx @aidemd-mcp\/server@latest (sync|init)`/i;
	const LATEST_LAUNCHER = "@aidemd-mcp/server@latest";
	const srcRoot = dirname(fileURLToPath(import.meta.url));

	function findOffendingLines(): string[] {
		const files = (readdirSync(srcRoot, { recursive: true }) as string[])
			.filter((rel) => rel.endsWith(".ts") && !rel.endsWith(".test.ts"));
		const offenders: string[] = [];
		for (const rel of files) {
			const lines = readFileSync(join(srcRoot, rel), "utf-8").split(/\r?\n/);
			lines.forEach((line, index) => {
				const trimmed = line.trimStart();
				if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
				if (line.includes(LATEST_LAUNCHER)) offenders.push(`${rel}:${index + 1}`);
			});
		}
		return offenders;
	}

	it("has no non-test, non-comment source line that mentions @aidemd-mcp/server@latest", () => {
		expect(findOffendingLines()).toEqual([]);
	});

	it("the guard substring matches a bare usage line", () => {
		expect("Usage: npx @aidemd-mcp/server@latest sync".includes(LATEST_LAUNCHER)).toBe(true);
	});

	it("the guard regex matches the old hardcoded remediation literal", () => {
		expect(NPX_ONLY_REMEDIATION.test("Run `npx @aidemd-mcp/server@latest init` to scaffold it")).toBe(true);
	});
});

describe("aide_cleanup registration", () => {
	const root = process.cwd();

	async function listTools(): Promise<
		{ name: string; description: string; inputSchema: { properties: Record<string, { type: string }>; required: string[] } }[]
	> {
		const { tools } = await handlers.get(ListToolsRequestSchema)!();
		return tools;
	}

	async function callTool(name: string, args: unknown) {
		return handlers.get(CallToolRequestSchema)!({ params: { name, arguments: args } });
	}

	async function findCleanup() {
		const tool = (await listTools()).find((t) => t.name === "aide_cleanup");
		if (!tool) throw new Error("aide_cleanup is not registered");
		return tool;
	}

	it("lists aide_cleanup requiring path, with optional boolean dryRun and no allowEmptyPlan", async () => {
		const { inputSchema } = await findCleanup();

		expect(inputSchema.required).toEqual(["path"]);
		expect(inputSchema.properties.path.type).toBe("string");
		expect(inputSchema.properties.dryRun.type).toBe("boolean");
		expect(inputSchema.properties).not.toHaveProperty("allowEmptyPlan");
	});

	it("describes the ephemerals, the out-of-reach session file, the no-plan path, and the optional dry run", async () => {
		const { description } = await findCleanup();

		expect(description).toContain("plan.aide");
		expect(description).toContain("todo.aide");
		expect(description).toContain("brief.aide");
		expect(description).toContain("session.aide");
		expect(description).toMatch(/dryRun is an optional preview/);
		expect(description).toMatch(/no plan\.aide/);
		expect(description).not.toMatch(/refuses unless plan\.aide exists/);
	});

	it("calls cleanup with the root and defaulted flags", async () => {
		mockCleanup.mockResolvedValue({ kind: "removed", module: "src/x", files: ["plan.aide"] } satisfies CleanupResult);

		await callTool("aide_cleanup", { path: "src/x" });

		expect(mockCleanup).toHaveBeenCalledWith(root, { path: "src/x", dryRun: false });
	});

	it("passes dryRun through", async () => {
		mockCleanup.mockResolvedValue({ kind: "would-remove", module: "src/x", files: ["plan.aide"] } satisfies CleanupResult);

		await callTool("aide_cleanup", { path: "src/x", dryRun: true });

		expect(mockCleanup).toHaveBeenCalledWith(root, { path: "src/x", dryRun: true });
	});

	it("drops a stale allowEmptyPlan argument", async () => {
		mockCleanup.mockResolvedValue({ kind: "removed", module: "src/x", files: ["plan.aide"] } satisfies CleanupResult);

		await callTool("aide_cleanup", { path: "src/x", allowEmptyPlan: true });

		expect(mockCleanup).toHaveBeenCalledWith(root, { path: "src/x", dryRun: false });
	});

	it("flags a refusal as an error and carries the refusal text", async () => {
		mockCleanup.mockResolvedValue({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "brief-without-plan", items: [] },
		} satisfies CleanupResult);

		const response = await callTool("aide_cleanup", { path: "src/x" });

		expect(response.isError).toBe(true);
		expect(response.content[0].text).toContain("brief.aide has no plan.aide beside it, and a brief is removed only together with its plan.");
	});

	it("does not flag a removal as an error", async () => {
		mockCleanup.mockResolvedValue({ kind: "removed", module: "src/x", files: ["plan.aide"] } satisfies CleanupResult);

		const response = await callTool("aide_cleanup", { path: "src/x" });

		expect(response.isError).toBe(false);
	});

	it("rejects a call without path", async () => {
		await expect(callTool("aide_cleanup", {})).rejects.toThrow();
	});
});

const brainMarkers = brainContract.map(({ marker }) => marker);

async function listTools(): Promise<
	{ name: string; description: string; inputSchema: { properties: Record<string, { type: string; enum?: string[] }> } }[]
> {
	const { tools } = await handlers.get(ListToolsRequestSchema)!();
	return tools;
}

async function findTool(name: string) {
	const tool = (await listTools()).find((t) => t.name === name);
	if (!tool) throw new Error(`${name} is not registered`);
	return tool;
}

async function callTool(name: string, args: unknown) {
	return handlers.get(CallToolRequestSchema)!({ params: { name, arguments: args } });
}

describe("aide_scaffold registration", () => {
	const root = process.cwd();

	it("lists the session type and requires directory and type", async () => {
		const { inputSchema } = (await findTool("aide_scaffold")) as unknown as {
			inputSchema: { properties: { type: { enum: string[] } }; required: string[] };
		};

		expect(inputSchema.properties.type.enum).toContain("session");
		expect(inputSchema.required).toEqual(["directory", "type"]);
	});

	it("accepts type session and passes it to scaffold", async () => {
		mockScaffold.mockResolvedValue("Created .aide/session.aide");

		const response = await callTool("aide_scaffold", { directory: "src/anything", type: "session" });

		expect(mockScaffold).toHaveBeenCalledWith(root, "src/anything", "session");
		expect(response.content[0].text).toBe("Created .aide/session.aide");
	});
});

describe("aide_frontmatter registration", () => {
	const root = process.cwd();

	it("lists aide_frontmatter requiring path, with path, field and value properties", async () => {
		const { inputSchema } = (await findTool("aide_frontmatter")) as unknown as {
			inputSchema: { properties: Record<string, { type: string }>; required: string[] };
		};

		expect(inputSchema.required).toEqual(["path"]);
		expect(Object.keys(inputSchema.properties)).toEqual(["path", "field", "value"]);
	});

	it("does not mention @latest in its description", async () => {
		const { description } = await findTool("aide_frontmatter");

		expect(description).not.toContain("@latest");
	});

	it("passes a read call to frontmatter with the root and the parsed input", async () => {
		mockFrontmatter.mockResolvedValue({
			kind: "read",
			path: "src/x/plan.aide",
			field: "status",
			current: { state: "set", value: "approved" },
			legacy: false,
		});

		const response = await callTool("aide_frontmatter", { path: "src/x/plan.aide" });

		expect(mockFrontmatter).toHaveBeenCalledWith(root, { path: "src/x/plan.aide" });
		expect(response.isError).toBe(false);
		expect(response.content[0].text).toContain("src/x/plan.aide");
	});

	it("passes a write call to frontmatter and reports a change without an error", async () => {
		mockFrontmatter.mockResolvedValue({
			kind: "changed",
			path: "src/x/plan.aide",
			field: "status",
			from: { state: "set", value: "proposed" },
			to: "approved",
			movedFromLegacy: false,
		});

		const response = await callTool("aide_frontmatter", { path: "src/x/plan.aide", field: "status", value: "approved" });

		expect(mockFrontmatter).toHaveBeenCalledWith(root, { path: "src/x/plan.aide", field: "status", value: "approved" });
		expect(response.isError).toBe(false);
		expect(response.content[0].text).toContain("approved");
	});

	it("flags a refused outcome as an error and carries the refusal text", async () => {
		mockFrontmatter.mockResolvedValue({ kind: "refused", path: "src/x/plan.aide", refusal: { kind: "pairing" } });

		const response = await callTool("aide_frontmatter", { path: "src/x/plan.aide", field: "status" });

		expect(response.isError).toBe(true);
		expect(response.content[0].text).toContain("field and value go together");
	});

	it("rejects a call without path", async () => {
		await expect(callTool("aide_frontmatter", {})).rejects.toThrow();
	});
});

describe("aide_upgrade brain category routing", () => {
	const root = process.cwd();
	const brainResult = { outcome: "inserted", inserted: ["playbook-index"] };

	it.each([
		["no selector", { category: "brain" }],
		["the launcher preview", { category: "brain", brainChange: "launcher" }],
		["a guarded apply", { category: "brain", brainChange: brainMarkers[0], beforeHash: "a".repeat(64) }],
	])("routes %s to brainCategory, returns its JSON verbatim and never runs upgrade", async (_label, args) => {
		mockBrainCategory.mockResolvedValue(brainResult);

		const response = await callTool("aide_upgrade", args);

		expect(mockBrainCategory).toHaveBeenCalledWith({
			root,
			path: undefined,
			brainChange: (args as { brainChange?: string }).brainChange,
			beforeHash: (args as { beforeHash?: string }).beforeHash,
		});
		expect(response.content[0].text).toBe(JSON.stringify(brainResult, null, 2));
		expect(mockUpgrade).not.toHaveBeenCalled();
	});

	it("passes the path through to brainCategory", async () => {
		mockBrainCategory.mockResolvedValue(brainResult);

		await callTool("aide_upgrade", { category: "brain", path: "/some/project" });

		expect(mockBrainCategory).toHaveBeenCalledWith({
			root,
			path: "/some/project",
			brainChange: undefined,
			beforeHash: undefined,
		});
	});

	it("sends a non-brain category through upgrade and not brainCategory", async () => {
		mockUpgrade.mockResolvedValue({ categories: [] });

		await callTool("aide_upgrade", { category: "commands" });

		expect(mockUpgrade).toHaveBeenCalled();
		expect(mockBrainCategory).not.toHaveBeenCalled();
	});

	it("rejects brainChange without a category", async () => {
		await expect(callTool("aide_upgrade", { brainChange: "launcher" })).rejects.toThrow();
		expect(mockBrainCategory).not.toHaveBeenCalled();
		expect(mockUpgrade).not.toHaveBeenCalled();
	});
});

describe("aide_upgrade registration", () => {
	it("registers brainChange as the contract markers plus launcher", async () => {
		const { inputSchema } = await findTool("aide_upgrade");

		expect(inputSchema.properties.brainChange.enum).toEqual([...brainMarkers, "launcher"]);
	});

	it("registers beforeHash as a string", async () => {
		const { inputSchema } = await findTool("aide_upgrade");

		expect(inputSchema.properties.beforeHash.type).toBe("string");
	});

	it("describes the brain calls and no longer claims the config is never written", async () => {
		const { description } = await findTool("aide_upgrade");

		expect(description).toContain("brainChange");
		expect(description).toContain("beforeHash");
		expect(description).toContain("inserted");
		expect(description).not.toContain("never writes the brain config");
	});
});

describe("aide_brain registration", () => {
	it("registers kind as the contract markers plus launcher", async () => {
		const { inputSchema } = await findTool("aide_brain");

		expect(inputSchema.properties.kind.enum).toEqual([...brainMarkers, "launcher"]);
	});

	it("registers source as a string with the four modes", async () => {
		const { inputSchema } = await findTool("aide_brain");

		expect(inputSchema.properties.source.type).toBe("string");
		expect(inputSchema.properties.source.enum).toEqual(["host", "template", "contract", "draft"]);
	});

	it("registers path as a string", async () => {
		const { inputSchema } = await findTool("aide_brain");

		expect(inputSchema.properties.path.type).toBe("string");
	});

	it("marks no property as required", async () => {
		const { inputSchema } = await findTool("aide_brain");

		expect(inputSchema).not.toHaveProperty("required");
	});

	it("registers only values BrainInput accepts in at least one valid combination", async () => {
		const { inputSchema } = await findTool("aide_brain");
		const extras: Record<string, Record<string, string>> = { draft: { path: "drafts/brain.aide" } };

		for (const source of inputSchema.properties.source.enum!) {
			expect(BrainInput.safeParse({ source, ...extras[source] }).success, `source ${source}`).toBe(true);
		}
		for (const kind of inputSchema.properties.kind.enum!) {
			const accepted = [{ kind }, { source: "template", kind }].some((candidate) => BrainInput.safeParse(candidate).success);
			expect(accepted, `kind ${kind}`).toBe(true);
		}
	});

	it("describes found and purpose and drops the two-field claim", async () => {
		const { description } = await findTool("aide_brain");

		expect(description).toContain("found");
		expect(description).toContain("purpose");
		expect(description).not.toContain("exactly two fields");
	});

	it.each(["source", '"template"', '"contract"', '"draft"', "launcher", "path", "found", "purpose", "read-only"])(
		"teaches %s in the description",
		async (term) => {
			const { description } = await findTool("aide_brain");

			expect(description).toContain(term);
		},
	);
});

describe("aide_brain routing", () => {
	const root = process.cwd();
	const helpers = [mockReadTemplateSection, mockListContract, mockValidateDraft];

	it.each([
		["no arguments", {}],
		["an explicit host read", { source: "host", kind: "config" }],
	])("routes %s to the host read only", async (_label, args) => {
		const hostResult = { status: "ok", instructions: "x", found: true };
		mockBrain.mockResolvedValue(hostResult);

		const response = await callTool("aide_brain", args);

		expect(mockBrain).toHaveBeenCalledWith(root, args);
		for (const helper of helpers) expect(helper).not.toHaveBeenCalled();
		expect(response.content[0].text).toBe(JSON.stringify(hostResult, null, 2));
	});

	it("routes a template read to readTemplateSection only", async () => {
		const templateResult = { template: "bytes", purpose: "p" };
		mockReadTemplateSection.mockReturnValue(templateResult);

		const response = await callTool("aide_brain", { source: "template", kind: "launcher" });

		expect(mockReadTemplateSection).toHaveBeenCalledWith({ kind: "launcher" });
		expect(mockBrain).not.toHaveBeenCalled();
		expect(mockListContract).not.toHaveBeenCalled();
		expect(mockValidateDraft).not.toHaveBeenCalled();
		expect(response.content[0].text).toBe(JSON.stringify(templateResult, null, 2));
	});

	it("routes a contract read to listContract only", async () => {
		const contractResult = { sections: [{ marker: "orientation", role: "live", purpose: "p" }] };
		mockListContract.mockReturnValue(contractResult);

		const response = await callTool("aide_brain", { source: "contract" });

		expect(mockListContract).toHaveBeenCalledTimes(1);
		expect(mockBrain).not.toHaveBeenCalled();
		expect(mockReadTemplateSection).not.toHaveBeenCalled();
		expect(mockValidateDraft).not.toHaveBeenCalled();
		expect(response.content[0].text).toBe(JSON.stringify(contractResult, null, 2));
	});

	it("routes a draft check to validateDraft only, with the root and path", async () => {
		const draftResult = { outcome: "valid", instructions: "ok" };
		mockValidateDraft.mockResolvedValue(draftResult);

		const response = await callTool("aide_brain", { source: "draft", path: "drafts/brain.aide" });

		expect(mockValidateDraft).toHaveBeenCalledWith({ root, path: "drafts/brain.aide" });
		expect(mockBrain).not.toHaveBeenCalled();
		expect(mockReadTemplateSection).not.toHaveBeenCalled();
		expect(mockListContract).not.toHaveBeenCalled();
		expect(response.content[0].text).toBe(JSON.stringify(draftResult, null, 2));
	});
});

describe("aide_brain boundary", () => {
	it.each([
		["launcher on a host read", { kind: "launcher" }],
		["kind on a contract read", { source: "contract", kind: "orientation" }],
		["a draft read without path", { source: "draft" }],
		["path on a template read", { source: "template", path: "x" }],
		["an unknown kind", { kind: "banana" }],
	])("rejects %s before any handler runs", async (_label, args) => {
		await expect(callTool("aide_brain", args)).rejects.toThrow();

		expect(mockBrain).not.toHaveBeenCalled();
		expect(mockReadTemplateSection).not.toHaveBeenCalled();
		expect(mockListContract).not.toHaveBeenCalled();
		expect(mockValidateDraft).not.toHaveBeenCalled();
	});
});

describe("aide_init registration", () => {
	it("teaches brainSummary and none of the retired brain contract fields", async () => {
		const { description } = await findTool("aide_init");

		expect(description).toContain("brainSummary");
		expect(description).not.toContain("brainContract");
		expect(description).not.toContain("brainRepair");
		expect(description).not.toContain("brainMigration");
	});
});

describe("aide_init summary call stays small for an invalid brain config", () => {
	const fixturePath = join(
		dirname(fileURLToPath(import.meta.url)),
		"service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	);
	let project: string;

	afterEach(() => {
		rmSync(project, { recursive: true, force: true });
	});

	it("keeps the brain config step under 4096 bytes, lists missing sections and omits template section text", async () => {
		project = mkdtempSync(join(tmpdir(), "aide-init-summary-"));
		mkdirSync(join(project, ".aide", "config"), { recursive: true });
		writeFileSync(join(project, ".aide", "config", "brain.aide"), readFileSync(fixturePath, "utf-8"));

		const response = await callTool("aide_init", { path: project });
		const text: string = response.content[0].text;
		const step = JSON.parse(text).steps.find((s: { name: string }) => s.name === "Brain config (brain.aide)");

		expect(step).toBeDefined();
		expect(Buffer.byteLength(JSON.stringify(step))).toBeLessThan(4096);
		expect(step.brainSummary.missingSections.length).toBeGreaterThan(0);

		const template = obsidianBrainAideTemplate();
		const startToken = "<!-- aide-orientation-start -->";
		const orientation = template.slice(
			template.indexOf(startToken) + startToken.length,
			template.indexOf("<!-- aide-orientation-end -->"),
		);
		const lines = orientation.split(/\r?\n/).filter((line) => line.trim().length > 0);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(text).not.toContain(line);
		}
	});
});

describe("tool descriptions stay backend-neutral", () => {
	it.each(["aide_init", "aide_upgrade", "aide_brain"])("%s names no backend-specific term", async (name) => {
		const { description } = await findTool(name);

		expect(description).not.toMatch(/\bobsidian\b|vault|wikilink|\[\[|mcp__|kanban-plugin/i);
	});
});
