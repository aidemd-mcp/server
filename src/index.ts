#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import discover, { DiscoverInput } from "@/tools/discover/index.js";
import read, { ReadInput } from "@/tools/read/index.js";
import scaffold, { ScaffoldInput } from "@/tools/scaffold/index.js";
import validate, { ValidateInput } from "@/tools/validate/index.js";
import init, { InitInput } from "@/tools/init/index.js";
import upgrade, { UpgradeInput } from "@/tools/upgrade/index.js";

/** Parse --root flag from CLI args, default to cwd. */
function parseRoot(): string {
	const args = process.argv.slice(2);
	const rootIdx = args.indexOf("--root");
	if (rootIdx !== -1 && args[rootIdx + 1]) return args[rootIdx + 1];
	return process.cwd();
}

const root = parseRoot();

const server = new Server(
	{ name: "aidemd-mcp", version: "0.2.0" },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "aide_discover",
			description:
				"Scan for .aide spec files in this project. Returns a tree map of where specs live, following progressive disclosure.\n\nWithout a path: returns a lightweight project-wide map — file locations and types only, no content. Use this once to understand the project's spec architecture.\n\nWith a path: returns a detailed subtree of that directory — includes summaries extracted from file content and anomaly warnings. Use this to drill into the area you're working on.\n\n.aide files are progressive disclosure specs that live next to orchestrator code — they contain intent (strategy, implementation contracts, anti-patterns), research (sources, data, patterns), or QA checklists (todo). Read .aide files BEFORE reading code — they are the context layer between folder structure and implementation details.\n\nFile types (.aide, intent.aide, research.aide, plan.aide, todo.aide):\n- .aide — Intent spec (default). Strategy, contracts, anti-patterns.\n- intent.aide — Same as .aide, used only when research.aide exists in the same folder.\n- research.aide — Raw research. Sources, data points, pattern synthesis.\n- plan.aide -- Architect's implementation plan. Checkboxed steps for the implementor.\n- todo.aide — QA re-alignment document. Captures where implementation drifted from intent.\n\nNever have both .aide and intent.aide in the same folder.",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description:
							"Subdirectory to drill into. When provided, returns detailed subtree with summaries and warnings. When omitted, returns a shallow project-wide map (locations and types only).",
					},
				},
			},
		},
		{
			name: "aide_read",
			description:
				"Read an .aide spec file with full context. Returns the file content, its classified type (intent/research/plan/todo), related specs in the same directory, and links found in the content (relative paths, wikilinks, URLs). Use this after aide_discover to drill into a specific spec.",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description: "Path to the .aide file to read",
					},
				},
				required: ["path"],
			},
		},
		{
			name: "aide_scaffold",
			description:
				"Create new .aide spec files with automatic naming convention enforcement. Handles the naming rules: intent specs are .aide by default, but become intent.aide when research.aide exists in the same folder. Creating a research.aide auto-renames any existing .aide to intent.aide.\n\nTypes:\n- intent — Strategy, contracts, anti-patterns\n- research — Sources, data, patterns (triggers rename of existing .aide)\n- both — Creates research.aide + intent.aide pair\n- todo — QA re-alignment document for QA agents\n- plan -- Architect's implementation plan (no naming interaction with intent/research)",
			inputSchema: {
				type: "object" as const,
				properties: {
					directory: {
						type: "string",
						description: "Directory where the .aide file(s) will be created",
					},
					type: {
						type: "string",
						enum: ["intent", "research", "both", "todo", "plan"],
						description: "Type of .aide file to create",
					},
				},
				required: ["directory", "type"],
			},
		},
		{
			name: "aide_validate",
			description:
				"Health check for .aide spec files in the project. Detects orphaned specs (in folders with no orchestrator), missing specs (orchestrators with 3+ helper imports but no .aide), naming conflicts (.aide + intent.aide in same folder), broken links, and orphaned research (research.aide without intent spec).",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description: "Subdirectory to validate (defaults to entire project)",
					},
				},
			},
		},
		{
			name: "aide_upgrade",
			description:
				"Update, upgrade, sync, or refresh the AIDE methodology artifacts in a project to the canonical versions shipped with this MCP server. Use this tool when the user asks to update AIDE, update the docs, update the commands, update the spec templates, sync AIDE, refresh AIDE, or bring AIDE up to date. This is NOT for editing user .aide specs — it updates the methodology infrastructure only.\n\nOperates in two phases.\n\nDefault (no confirm): returns a dry-run preview listing every file that would be overwritten — commands, docs, agents, skills, pointer stub, MCP config, and IDE config. No files are written.\n\nWith confirm: true: overwrites all methodology artifacts with the canonical versions. User code and user .aide specs are never touched — only the AIDE-owned surface is replaced.\n\nUpgrade surface (everything in this list may be overwritten):\n- Slash commands for all pipeline phases\n- Canonical methodology docs under .aide/docs/\n- Pipeline agent files under .claude/agents/aide/\n- Skill templates under .claude/skills/\n- AIDE pointer stub in the agent config file\n- MCP server entry in the project's MCP config\n- IDE file association config (unless skipIde is set)\n\nIf you have edited any commands, docs, agents, or the pointer stub directly, those customizations will be lost. Customizations belong in your user .aide specs and application code, not in the methodology artifacts.\n\nSupports Claude Code (CLAUDE.md), Cursor (.cursorrules), Windsurf (.windsurfrules), and Copilot (.github/copilot-instructions.md). Auto-detects the framework or accepts an override.",
			inputSchema: {
				type: "object" as const,
				properties: {
					confirm: {
						type: "boolean",
						description:
							"When false (default), returns a dry-run preview. When true, overwrites methodology artifacts with canonical versions.",
					},
					framework: {
						type: "string",
						enum: ["claude", "cursor", "windsurf", "copilot"],
						description:
							"Force a specific framework instead of auto-detecting. Auto-detection checks for framework-specific files/directories and defaults to Claude Code.",
					},
					path: {
						type: "string",
						description: "Custom project root path (defaults to server working directory)",
					},
					skipIde: {
						type: "boolean",
						description: "Skip IDE file association configuration (Zed settings, VS Code extension)",
					},
				},
			},
		},
		{
			name: "aide_init",
			description:
				"Bootstrap the AIDE development environment into a Claude Code project. This is the one-command setup that installs a short AIDE pointer stub into CLAUDE.md, lands the full canonical methodology docs as a progressively-disclosed doc hub under `.aide/docs/`, scaffolds slash commands for every pipeline phase (research, spec, synthesize, plan, build, QA, fix) plus the /aide orchestrator entry point, installs agent definitions and skill templates, wires this MCP server into `.mcp.json`, and provisions the brain layer (creates a minimal Obsidian vault if none exists and wires the Obsidian MCP server so agents declaring mcpServers: [obsidian] can persist and retrieve domain knowledge).\n\nMethodology delivery is split on purpose: CLAUDE.md carries only a short pointer stub that names the `.aide/docs/` hub and tells the agent to crawl it before writing or acting on any `.aide` file — so non-AIDE sessions pay almost nothing to carry it. The full canonical docs live under `.aide/docs/` on the host's disk, where the agent reads them on demand.\n\nBrain provisioning discovers the vault path via a priority chain: explicit brainPath parameter → AIDE_BRAIN_PATH environment variable → sibling my-brain/ directory next to the project → ~/my-brain. If a vault already exists, its contents are left alone. If no vault exists at the resolved path, a minimal scaffolding is created (research/, process/retro/, coding-playbook/). The Obsidian MCP server (@bitbonsai/mcpvault) is wired into .mcp.json unless it's already present there or in ~/.claude.json.\n\nEach step is idempotent — running aide_init on an already-initialized project reports what's present without overwriting. After initialization, every agent session starts with the AIDE pointer stub in CLAUDE.md, the full methodology in `.aide/docs/`, slash commands for each pipeline phase, agent definitions, skill templates, MCP tools for discovery/reading/scaffolding/validation, and brain access for research/retro/playbook agents.",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description: "Custom project root path (defaults to server working directory)",
					},
					skipIde: {
						type: "boolean",
						description: "Skip IDE file association configuration (Zed settings, VS Code extension)",
					},
					brainPath: {
						type: "string",
						description: "Explicit Obsidian vault path for brain provisioning (auto-discovered if omitted via AIDE_BRAIN_PATH env var → sibling my-brain/ → ~/my-brain)",
					},
				},
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	switch (name) {
		case "aide_discover": {
			const parsed = DiscoverInput.parse(args);
			const result = await discover(root, parsed.path);
			return { content: [{ type: "text", text: result }] };
		}
		case "aide_read": {
			const parsed = ReadInput.parse(args);
			const result = await read(root, parsed.path);
			return {
				content: [
					{
						type: "text",
						text: `# ${result.type} spec\n\n${result.content}\n\n---\nSiblings: ${result.siblings.map((s) => s.relativePath).join(", ") || "none"}\nLinks: ${result.links.join(", ") || "none"}`,
					},
				],
			};
		}
		case "aide_scaffold": {
			const parsed = ScaffoldInput.parse(args);
			const result = await scaffold(root, parsed.directory, parsed.type);
			return { content: [{ type: "text", text: result }] };
		}
		case "aide_validate": {
			const parsed = ValidateInput.parse(args);
			const result = await validate(root, parsed.path);
			const summary =
				result.warnings.length === 0
					? "No issues found."
					: result.warnings.map((w) => `[${w.kind}] ${w.path} — ${w.message}`).join("\n");
			return { content: [{ type: "text", text: summary }] };
		}
		case "aide_init": {
			const parsed = InitInput.parse(args);
			const result = await init(root, parsed.framework, parsed.path, parsed.skipIde, parsed.brainPath);
			return { content: [{ type: "text", text: result }] };
		}
		case "aide_upgrade": {
			const parsed = UpgradeInput.parse(args);
			const result = await upgrade(root, parsed.confirm, parsed.framework, parsed.path, parsed.skipIde);
			return { content: [{ type: "text", text: result }] };
		}
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
});

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error) => {
	console.error("Fatal:", error);
	process.exit(1);
});
