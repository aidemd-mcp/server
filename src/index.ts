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
				"Compare the AIDE methodology artifacts in this project against the canonical versions and return structured JSON results grouped by category. Use this when the user asks to update AIDE, sync AIDE, refresh AIDE, check for AIDE updates, or bring AIDE up to date. This is NOT for editing user .aide specs — it inspects methodology infrastructure only.\n\nThe tool never writes files. It returns an UpgradeResult with per-category comparison results. As the calling agent, you must:\n1. Present each category that has drifted (differs/missing files) and ask the user which categories to apply\n2. For each confirmed category, write the files using the `canonicalContent` provided in each UpgradeFileResult\n3. For the `mcp` category, merge the `prescription` entry into the existing MCP config yourself (read → merge → write). If the MCP config is `malformed`, tell the user and ask how to proceed — do not overwrite\n4. For the `ide` category, apply Zed settings and VS Code extension separately after asking the user\n5. Skip categories where the summary shows `differs: 0, missing: 0` — nothing to update\n\nCategories: pointer-stub, methodology-docs, version-metadata, commands, agents, skills, mcp, ide.\n\nUpgrade surface (files this tool inspects — user code and user .aide specs are never touched):\n- AIDE pointer stub in the agent config file\n- Canonical methodology docs under .aide/docs/\n- versions.json metadata under .aide/docs/\n- Slash commands for all pipeline phases\n- Pipeline agent files\n- Skill templates\n- MCP server entry in the project's MCP config\n- IDE file association config (Zed settings, VS Code extension)\n\nSupports Claude Code (CLAUDE.md), Cursor (.cursorrules), Windsurf (.windsurfrules), and Copilot (.github/copilot-instructions.md). Auto-detects the framework or accepts an override.",
			inputSchema: {
				type: "object" as const,
				properties: {
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
				},
			},
		},
		{
			name: "aide_init",
			description:
				"Bootstrap the AIDE development environment into a project. Returns structured JSON for agent consumption — not prose.\n\nThe response is an InitResult with three fields:\n- `framework`: the detected (or overridden) agent framework\n- `steps`: an array of InitStep objects, each with `name`, `status` (would-create/would-skip/exists), `category`, `filePath`, and optionally `content` (bytes to write) or `prescription` (MCP server entry to merge). Steps with `configMalformed: true` indicate the MCP config cannot be parsed.\n- `brainHints`: an array of BrainHint objects (source + path) for vault candidates the agent should present to the user\n\nAs the calling agent, you must:\n1. Present the detected framework and ask the user to confirm or override\n2. Summarize each category of would-create steps and ask the user to apply\n3. Ask the user where their brain vault is — offer the brainHints as suggestions\n4. Merge any MCP prescriptions into the config file yourself (read → merge → write)\n5. Apply IDE steps only after asking the user\n\nDo NOT auto-apply steps without user confirmation. Do NOT call this tool expecting it to write files — it is a planner only.",
			inputSchema: {
				type: "object" as const,
				properties: {
					framework: {
						type: "string",
						enum: ["claude", "cursor", "windsurf", "copilot"],
						description: "Force a specific framework instead of auto-detecting. Use this when re-calling after the user confirms or overrides detection.",
					},
					path: {
						type: "string",
						description: "Custom project root path (defaults to server working directory)",
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
			const result = await init(root, parsed.framework, parsed.path);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		}
		case "aide_upgrade": {
			const parsed = UpgradeInput.parse(args);
			const result = await upgrade(root, parsed.framework, parsed.path);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
