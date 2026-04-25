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
import init, { InitInput } from "@/service/install/index.js";
import applySteps from "@/service/install/applySteps/index.js";
import upgrade, { UpgradeInput } from "@/tools/upgrade/index.js";
import applyFiles from "@/tools/upgrade/applyFiles/index.js";
import info, { InfoInput } from "@/tools/info/index.js";
import brain, { BrainInput } from "@/tools/brain/index.js";
import inspect, { InspectInput } from "@/tools/inspect/index.js";

/**
 * Check process.argv for a known subcommand and dispatch it via dynamic
 * import. Returns true if a subcommand was handled (caller must not start
 * the MCP server). Returns false when no subcommand matched.
 */
export async function routeSubcommand(): Promise<boolean> {
	if (process.argv[2] === "init") {
		await import("./cli/init/index.js");
		return true;
	}
	return false;
}

/** Parse --root flag from CLI args, default to cwd. */
function parseRoot(): string {
	const args = process.argv.slice(2);
	const rootIdx = args.indexOf("--root");
	if (rootIdx !== -1 && args[rootIdx + 1]) return args[rootIdx + 1];
	return process.cwd();
}

const root = parseRoot();

const server = new Server(
	{ name: "@aidemd-mcp/server", version: "0.2.0" },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "aide_discover",
			description:
				"Scan for .aide spec files in this project. Returns a tree map of where specs live, following progressive disclosure.\n\nWithout a path: returns a lightweight project-wide map — file locations and types only, no content. Use this once to understand the project's spec architecture.\n\nWith a path: the response opens with the ancestor chain — the cascading intent lineage from project root down to the target directory, with each ancestor showing its description and alignment status (aligned/misaligned when set). The ancestor chain gives you the full inherited context before you read a single spec body. After the ancestor chain comes the detailed subtree of the target directory — summaries extracted from file content and anomaly warnings. Use this to drill into the area you're working on.\n\n.aide files are progressive disclosure specs that live next to orchestrator code — they contain intent (strategy, implementation contracts, anti-patterns), research (sources, data, patterns), or QA checklists (todo). Read .aide files BEFORE reading code — they are the context layer between folder structure and implementation details.\n\nFile types (.aide, intent.aide, research.aide, plan.aide, todo.aide):\n- .aide — Intent spec (default). Strategy, contracts, anti-patterns.\n- intent.aide — Same as .aide, used only when research.aide exists in the same folder.\n- research.aide — Raw research. Sources, data points, pattern synthesis.\n- plan.aide -- Architect's implementation plan. Checkboxed steps for the implementor.\n- todo.aide — QA re-alignment document. Captures where implementation drifted from intent.\n\nNever have both .aide and intent.aide in the same folder.",
			inputSchema: {
				type: "object" as const,
				properties: {
					path: {
						type: "string",
						description:
							"Subdirectory to drill into. When provided, the response opens with the ancestor chain — the cascading intent lineage from root to target, each ancestor showing its description and alignment status — followed by the detailed subtree with summaries and warnings. When omitted, returns a shallow project-wide map (locations and types only).",
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
				"Health check for .aide spec files in the project. Detects orphaned specs (in folders with no orchestrator), missing specs (orchestrators with 3+ helper imports but no .aide), naming conflicts (.aide + intent.aide in same folder), broken links, orphaned research (research.aide without intent spec), and missing descriptions (specs with no description field in frontmatter).",
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
				"Compare the AIDE methodology artifacts in this project against the canonical versions and return structured JSON results grouped by category. Use this when the user asks to update AIDE, sync AIDE, refresh AIDE, check for AIDE updates, or bring AIDE up to date. This is NOT for editing user .aide specs — it inspects methodology infrastructure only.\n\nThe tool uses a two-call pattern for progressive disclosure:\n\n**First call (no `category` param):** Returns a lightweight summary — every category with file names, statuses, and counts, but NO file content. Use this to understand what has drifted and present a summary to the user. Ask which categories they want to apply.\n\n**Second call (with `category` param):** The tool writes all differs/missing files directly to disk itself and returns a manifest — file results with `filePath`, `status` (`\"updated\"`, `\"created\"`, or `\"matches\"`), and `name`, but NO `canonicalContent`. The agent never sees file content and never uses the Write tool for methodology files.\n\nRepeat the second call for each category the user confirms.\n\nAs the calling agent, you must:\n1. Call without `category` first to get the summary\n2. Present each drifted category (differs/missing) and ask the user which to apply\n3. For each confirmed category, call again with `category=X` — the tool writes the files and returns a manifest. Report what was updated/created to the user.\n4. For the `mcp` category, the manifest still includes `prescription` data — merge the entry into the existing MCP config yourself (read → merge → write). If `malformed`, tell the user — do not overwrite.\n5. For `ide`, the manifest may include `instructions` for VS Code extension install — execute that command for the user. Zed config is written directly by the tool.\n\n**IMPORTANT — one-at-a-time wizard pattern using AskUserQuestion:**\nDo NOT present all categories at once. Walk the user through ONE category at a time using AskUserQuestion with Yes/Skip options. Stop after each question and wait for confirmation before calling with that category.\n\nCategories: pointer-stub, methodology-docs, version-metadata, commands, agents, skills, mcp, ide, readme.\n\nUpgrade surface (user code and user .aide specs are never touched):\n- AIDE pointer stub in the agent config file\n- Canonical methodology docs under .aide/docs/\n- versions.json metadata under .aide/docs/\n- Slash commands for all pipeline phases\n- Pipeline agent files, skill templates\n- MCP server entry in the project's MCP config\n- IDE file association config (Zed settings, VS Code extension)\n\nSupports Claude Code, Cursor, Windsurf, and Copilot. Auto-detects the framework or accepts an override.",
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
					category: {
						type: "string",
						enum: ["pointer-stub", "methodology-docs", "version-metadata", "commands", "agents", "skills", "mcp", "ide", "readme"],
						description:
							"Write all differs/missing files for this category to disk and return a manifest. Omit on the first call to get a metadata-only summary of all categories.",
					},
				},
			},
		},
		{
			name: "aide_info",
			description:
				"Boot-time reporter called by the orchestrator at startup. Returns two independent top-level fields that the orchestrator must branch on separately:\n\n**`outdated` (array of stale artifact keys) — soft notification.**\nCompares the host's `.aide/versions.json` against the canonical manifest shipped with this npm package. Each element names an artifact key that is behind. An empty array means everything is current. A missing `.aide/versions.json` (old install predating version tracking) silently collapses to `[]`. Staleness is informational — the orchestrator continues with a heads-up to the user.\n\n**`brain` (precondition state) — hard gate.**\nReports whether the host's Obsidian brain vault is ready. Shape: `{ status: 'ok' | 'no-mcp-entry' | 'invalid-path', vaultPath: string | null }`. The orchestrator must halt and direct the user to resolve the issue before continuing if `status` is not `'ok'`.\n\nThe three `brain.status` values:\n- `ok` — the host's MCP config contains a `brain` entry and its configured vault directory exists on disk. `vaultPath` is the resolved path string. The pipeline may proceed.\n- `no-mcp-entry` — the MCP config is missing, malformed, or contains no `brain` entry. `vaultPath` is `null`. Remediation: run `/aide`; the orchestrator's inline-recovery flow detects the missing state and prompts the user to configure the brain.\n- `invalid-path` — a `brain` entry exists but its configured `vaultPath` does not resolve to a directory on disk. `vaultPath` is the path string that failed. Remediation: fix the path in the existing MCP config entry or restore the missing directory.\n\nNo parameters needed — uses the server's working directory.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		},
		{
			name: "aide_brain",
			description:
				"On-demand brain entry-point tool. Call this when you need to reach the brain mid-task — do NOT call it on every /aide boot. Boot-time brain precondition state is already reported by aide_info.brain.status; firing aide_brain at boot duplicates that work unnecessarily.\n\nNo parameters — uses the server's working directory.\n\n**Response shape: `{ status, backend, instructions }`**\n\n`status` — identical vocabulary to aide_info.brain.status: `ok`, `no-mcp-entry`, or `invalid-path`. An agent that already saw boot-time brain state does not learn new terms here.\n\n`backend` — the structured identifier of the wired backend (e.g. `\"obsidian\"`) when `status` is `ok`; `null` on all other branches. Use this field to branch programmatically without parsing prose.\n\n`instructions` — always non-empty, ready-to-execute prose composed by the server. Act on this field directly:\n- On `ok`: names the specific MCP tools to call and how to reach the brain's entry-point file. Once you read that file the brain takes over — do not ask the server for further navigation.\n- On `no-mcp-entry`: no brain backend is wired. Surface this to the user and recommend running /aide:brain config. Do not proceed as if the brain were available.\n- On `invalid-path`: a brain backend is configured but its vault path does not resolve on disk. Surface this to the user and recommend running /aide:brain config to repoint the vault. Do not proceed as if the brain were available.\n\nThe server assembles all prose — you never need to construct MCP tool calls or vault paths from structured fields.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		},
		{
			name: "aide_init",
			description:
				"Bootstrap the AIDE development environment into a project. Returns structured JSON for agent consumption — not prose.\n\nThe tool uses a two-call pattern for progressive disclosure:\n\n**First call (no `category` param):** Returns a lightweight summary — every step with `name`, `status` (would-create/would-overwrite/would-skip/exists), `category`, and `filePath`, but NO `content` fields. Also returns `brainHints` (vault candidates) and detected `framework`. Use this to understand what needs to be done and which categories require user prompts.\n\n**Second call (with `category` param):** The tool writes all `would-create` AND approved `would-overwrite` files directly to disk itself and returns a manifest — steps with `filePath`, `status` (`created`, `overwritten`, or `exists`), and `name`, but NO `content`. `would-skip` steps stay `would-skip` in the manifest (tool writes nothing for them). The agent never sees file content and never uses the Write tool for new files.\n\n**Exception — MCP steps:** For MCP steps, the manifest includes `prescription` data (key name and entry object) so the agent can read the existing config, merge, and write. The tool never touches MCP config directly.\n\n**Exception — brain category:** When calling with `category=brain`, also pass `brainPath` with the user-confirmed vault path. The tool creates the vault scaffold directories directly.\n\n**Exception — IDE VS Code steps:** IDE steps that need external tooling (VS Code CLI) return instructions for the agent to execute, since those aren't simple file writes.\n\n**Agent branch logic — silent-on-create, prompt-on-overwrite:**\n\nAfter the first call, walk the categories using this rule:\n- **Pure-create category** (all steps are `would-create`, `would-skip`, or `exists`): apply silently by calling with `category=X` immediately — no AskUserQuestion. A category with nothing on disk to overwrite has no decision the user can inform.\n- **Overwrite-bearing category** (any step is `would-overwrite`): pause and use AskUserQuestion with structured options. Name the files that would be overwritten. If the user approves, call with `category=X` — the tool overwrites and returns `overwritten` in the manifest. If the user declines an overwrite but wants the new files, call with `category=X` — the tool writes only `would-create` steps; the `would-overwrite` step stays `would-overwrite` in the manifest.\n- **Inherent-decision categories** (framework, brain vault path, MCP config merge, IDE choice): always use AskUserQuestion regardless of disk state. These are not file-write decisions — filesystem contents cannot resolve them.\n\n**IMPORTANT — one-at-a-time wizard pattern using AskUserQuestion:**\nDo NOT present a summary table of all categories. Do NOT offer \"all\" as an option. Do NOT ask conversational questions — use the `AskUserQuestion` tool with structured options at every pause point.\n\n1. Call without `category` first to get the metadata\n2. Present ONLY the detected framework — use AskUserQuestion with Yes/{alternatives} options. STOP.\n3. Walk categories in order: methodology, commands, agents, skills, mcp, brain, ide, readme. For each:\n   - Pure-create: apply silently (call with `category=X`), report results, move to next.\n   - Overwrite-bearing: use AskUserQuestion naming the would-overwrite files. STOP. Wait for selection, then call with `category=X`. Report manifest (created N, overwrote M). Move to next.\n   - Inherent decision: always use AskUserQuestion. STOP.\n4. For brain: use AskUserQuestion with brainHints as labeled options (user can pick Other for custom path). STOP. Then call with `category=brain` and `brainPath`.\n5. For MCP: use AskUserQuestion with Merge/Skip options. Merge the `prescription` entry into the existing config yourself (read → merge → write). STOP.\n6. For IDE: use AskUserQuestion with multiSelect for Zed/VS Code/Neither. STOP.\n\nEach pause point is ONE AskUserQuestion → wait for selection → then proceed. Never show multiple categories at once. Never ask open-ended conversational questions.",
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
					category: {
						type: "string",
						enum: ["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide", "readme"],
						description:
							"Write all would-create and approved would-overwrite files for this category to disk and return a manifest (status: created/overwritten/exists; would-skip steps pass through unchanged). Omit on the first call to get a metadata-only summary of all steps.",
					},
					brainPath: {
						type: "string",
						description: "Resolved brain vault path. Required when category=brain. The agent provides this after interviewing the user.",
					},
				},
			},
		},
		{
			name: "aide_inspect",
			description:
				"Return JSDoc, signature, and kind for a named symbol without opening the full file — Tier 2 progressive disclosure for code. When an agent knows a function name from an import list or orchestrator file, call inspect to learn what the symbol does, what it accepts, and what it returns, based on its contract alone. Searches across TypeScript and JavaScript source files (ts, tsx, js, jsx, mjs, cjs). Use the optional `file` parameter to narrow the search to a single file when the location is already known.",
			inputSchema: {
				type: "object" as const,
				properties: {
					name: {
						type: "string",
						description: "Symbol name to look up",
					},
					file: {
						type: "string",
						description: "Optional file path to narrow search to a single file",
					},
				},
				required: ["name"],
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
			const result = await init(root, parsed.framework, parsed.path, parsed.brainPath);
			if (parsed.category) {
				// Category-specific call: filter to matching steps, write files to
				// disk via applySteps, and return a manifest (no content).
				result.steps = result.steps.filter((s) => s.category === parsed.category);
				result.steps = await applySteps(result.steps);
			} else {
				// Summary call: strip content to keep response small
				result.steps = result.steps.map(({ content: _content, ...rest }) => rest);
			}
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		}
		case "aide_upgrade": {
			const parsed = UpgradeInput.parse(args);
			const result = await upgrade(root, parsed.framework, parsed.path);
			if (parsed.category) {
				// Category-specific call: filter to the requested category, write files
				// to disk via applyFiles, and return a manifest (no canonicalContent).
				const filtered = result.categories.filter((c) => c.category === parsed.category);
				result.categories = await Promise.all(
					filtered.map(async (cat) => {
						const appliedFiles = await applyFiles(cat.files);
						// Recompute summary from post-apply statuses
						const summary = {
							total: appliedFiles.length,
							differs: appliedFiles.filter((f) => f.status === "differs").length,
							missing: appliedFiles.filter((f) => f.status === "missing").length,
							matches: appliedFiles.filter((f) => f.status === "matches").length,
							updated: appliedFiles.filter((f) => f.status === "updated").length,
							created: appliedFiles.filter((f) => f.status === "created").length,
							unchanged: appliedFiles.filter((f) => f.status === "unchanged").length,
						};
						// Defense in depth: strip any residual canonicalContent
						const manifestFiles = appliedFiles.map(({ canonicalContent: _content, ...rest }) => rest);
						return { ...cat, files: manifestFiles, summary };
					}),
				);
			} else {
				// Summary call: strip canonicalContent to keep response small
				result.categories = result.categories.map((cat) => ({
					...cat,
					files: cat.files.map(({ canonicalContent: _content, ...rest }) => rest),
				}));
			}
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		}
		case "aide_info": {
			InfoInput.parse(args);
			const result = await info(root);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		}
		case "aide_brain": {
			BrainInput.parse(args);
			const result = await brain(root);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		}
		case "aide_inspect": {
			const parsed = InspectInput.parse(args);
			const result = await inspect(root, parsed.name, parsed.file);
			if (result.hits.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No symbol "${parsed.name}" found. Check the name or specify a file path to narrow the search.`,
						},
					],
				};
			}
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

// Route subcommands before starting the MCP server to avoid stdio conflicts.
// If routeSubcommand() returns true, the init IIFE handles process lifecycle.
if (!(await routeSubcommand())) {
	main().catch((error) => {
		console.error("Fatal:", error);
		process.exit(1);
	});
}
