#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import discover, { DiscoverInput } from "./tools/discover/index.js";
import read, { ReadInput } from "./tools/read/index.js";
import scaffold, { ScaffoldInput } from "./tools/scaffold/index.js";
import validate, { ValidateInput } from "./tools/validate/index.js";
import init, { InitInput } from "./tools/init/index.js";

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
				"Scan for .aide spec files in this project. .aide files are progressive disclosure specs that live next to orchestrator code — they contain intent (strategy, implementation contracts, anti-patterns), research (sources, data, patterns), or QA checklists (todo). Read .aide files BEFORE reading code — they are the context layer between folder structure and implementation details.\n\nFile types:\n- .aide — Intent spec (default). Strategy, contracts, anti-patterns.\n- intent.aide — Same as .aide, used only when research.aide exists in the same folder.\n- research.aide — Raw research. Sources, data points, pattern synthesis.\n- todo.aide — QA checklist. Issues found by audit agents.\n\nNever have both .aide and intent.aide in the same folder.",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description: "Subdirectory to scan (defaults to entire project)",
					},
				},
			},
		},
		{
			name: "aide_read",
			description:
				"Read an .aide spec file with full context. Returns the file content, its classified type (intent/research/todo), related specs in the same directory, and links found in the content (relative paths, wikilinks, URLs). Use this after aide_discover to drill into a specific spec.",
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
				"Create new .aide spec files with automatic naming convention enforcement. Handles the naming rules: intent specs are .aide by default, but become intent.aide when research.aide exists in the same folder. Creating a research.aide auto-renames any existing .aide to intent.aide.\n\nTypes:\n- intent — Strategy, contracts, anti-patterns\n- research — Sources, data, patterns (triggers rename of existing .aide)\n- both — Creates research.aide + intent.aide pair\n- todo — QA checklist for audit agents",
			inputSchema: {
				type: "object" as const,
				properties: {
					directory: {
						type: "string",
						description: "Directory where the .aide file(s) will be created",
					},
					type: {
						type: "string",
						enum: ["intent", "research", "both", "todo"],
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
			name: "aide_init",
			description:
				"Bootstrap the AIDE development environment into a project. This is the one-command setup that writes the AIDE methodology into the agent's config file, scaffolds slash commands for every pipeline phase (research, spec, build, QA, fix), and wires this MCP server into the project's MCP config.\n\nSupports Claude Code (CLAUDE.md), Cursor (.cursorrules), Windsurf (.windsurfrules), and Copilot (.github/copilot-instructions.md). Auto-detects the framework or accepts an override.\n\nEach step is idempotent — running aide_init on an already-initialized project reports what's present without overwriting. After initialization, the next agent session starts with the full AIDE methodology in context, slash commands for each pipeline phase, and MCP tools for discovery/reading/scaffolding/validation.",
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
