import { z } from "zod";
import { join, dirname, isAbsolute } from "node:path";
import { homedir } from "node:os";
import type { FrameworkType, InitStepResult } from "@/types/index.js";
import detectFramework from "@/tools/init/detectFramework/index.js";
import { configureZed, configureVscode } from "@/tools/init/configureIde/index.js";
import writeMethodology from "./writeMethodology/index.js";
import installMethodologyDocs from "./installMethodologyDocs/index.js";
import scaffoldCommands from "./scaffoldCommands/index.js";
import installAgents from "./installAgents/index.js";
import installSkills from "./installSkills/index.js";
import wireMcp from "./wireMcp/index.js";
import provisionBrain from "./provisionBrain/index.js";

export const InitInput = z.object({
	framework: z.enum(["claude", "cursor", "windsurf", "copilot"]).optional().describe("Force a specific framework instead of auto-detecting"),
	path: z.string().optional().describe("Custom project root path (defaults to server working directory)"),
	skipIde: z.boolean().optional().describe("Skip IDE file association configuration (Zed settings, VS Code extension)"),
	brainPath: z.string().optional().describe("Explicit Obsidian vault path (auto-discovered if omitted)"),
});

/**
 * Bootstrap the AIDE development environment into a project.
 * Detects the agent framework, installs the host-side methodology doc
 * hub, writes the AIDE pointer stub into the framework's config file,
 * scaffolds slash commands, and wires the MCP config. Each step is
 * idempotent and reports its status independently.
 */
export default async function init(root: string, framework?: FrameworkType, path?: string, skipIde?: boolean, brainPath?: string): Promise<string> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework, brainPath);

	// Install the doc hub first so the stub's pointer always names a
	// populated target on cold runs. Order is not load-bearing for
	// idempotency — every step detects its own state — but landing the
	// hub before the stub keeps the on-disk transition monotonic.
	const docResults = await installMethodologyDocs(join(projectRoot, config.docHubDir), config.docHubDir);
	const methodologyResult = await writeMethodology(join(projectRoot, config.configPath), config.docHubDir);
	const commandResults = await scaffoldCommands(join(projectRoot, config.commandDir));
	const agentResults = await installAgents(join(projectRoot, config.agentDir));
	const skillResults = await installSkills(join(projectRoot, config.skillDir));
	const mcpResult = await wireMcp(join(projectRoot, config.mcpConfigPath));

	// Resolve the user-level MCP config so provisionBrain can skip wiring when
	// obsidian is already registered globally. Only Claude Code uses ~/.claude.json;
	// other frameworks have no user-level MCP config to check.
	const userMcpConfigPath = config.framework === "claude" ? join(homedir(), ".claude.json") : undefined;
	const brainResults = await provisionBrain(config.brainPath, join(projectRoot, config.mcpConfigPath), userMcpConfigPath);

	const ideResults: InitStepResult[] = [];
	if (!skipIde) {
		ideResults.push(await configureZed(projectRoot));
		const extensionsDir = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "extensions", "vscode");
		ideResults.push(await configureVscode(extensionsDir));
	}

	// Brain results with status "skipped" mean no vault path was resolved — the brain
	// layer was not provisioned, not merely optional. Exclude them from the warm-run
	// "all present" check so the summary does not claim they exist.
	const brainWasSkipped = brainResults.every((r) => r.status === "skipped");
	const allResults = [methodologyResult, ...docResults, ...commandResults, ...agentResults, ...skillResults, mcpResult, ...brainResults, ...ideResults];
	const presentResults = brainWasSkipped ? allResults.filter((r) => !brainResults.includes(r)) : allResults;
	const allExist = presentResults.every((r) => r.status === "exists" || r.status === "skipped");

	if (allExist) {
		return `AIDE already initialized (${config.framework} framework detected).\n\nAll components present:\n${presentResults.map((r) => `  - ${r.name}`).join("\n")}\n\nRun aide_discover to see existing specs.`;
	}

	const lines = allResults.map((r) => {
		const done = r.status === "exists" || r.status === "skipped";
		const label = r.status === "created" ? "Created" : r.status === "installed" ? "Installed" : r.status === "wired" ? "Wired" : r.status === "skipped" ? "Skipped" : "Already exists";
		return `  ${done ? "-" : "\u2713"} ${r.name}: ${label}`;
	});
	const createdCommands = commandResults.filter((r) => r.status === "created").map((r) => r.name);

	const brainLine = config.brainPath ? `\nBrain: ${config.brainPath}` : "";
	return `AIDE initialized (${config.framework} framework):\n\n${lines.join("\n")}\n\nConfig: ${config.configPath}\nDoc hub: ${config.docHubDir}\nCommands: ${config.commandDir}\nMCP: ${config.mcpConfigPath}${brainLine}${createdCommands.length > 0 ? `\n\nNew commands: ${createdCommands.join(", ")}` : ""}\n\nNext steps: run aide_discover to see existing specs, or /aide:research to start a new one.`;
}
