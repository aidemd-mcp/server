import { z } from "zod";
import { join, dirname, isAbsolute } from "node:path";
import type { FrameworkType, InitStepResult } from "@/types/index.js";
import detectFramework from "@/tools/init/detectFramework/index.js";
import { configureZed, configureVscode } from "@/tools/init/configureIde/index.js";
import writeMethodology from "./writeMethodology/index.js";
import installMethodologyDocs from "./installMethodologyDocs/index.js";
import scaffoldCommands from "./scaffoldCommands/index.js";
import installAgents from "./installAgents/index.js";
import installSkills from "./installSkills/index.js";
import wireMcp from "./wireMcp/index.js";

export const InitInput = z.object({
	framework: z.enum(["claude", "cursor", "windsurf", "copilot"]).optional().describe("Force a specific framework instead of auto-detecting"),
	path: z.string().optional().describe("Custom project root path (defaults to server working directory)"),
	skipIde: z.boolean().optional().describe("Skip IDE file association configuration (Zed settings, VS Code extension)"),
});

/**
 * Bootstrap the AIDE development environment into a project.
 * Detects the agent framework, installs the host-side methodology doc
 * hub, writes the AIDE pointer stub into the framework's config file,
 * scaffolds slash commands, and wires the MCP config. Each step is
 * idempotent and reports its status independently.
 */
export default async function init(root: string, framework?: FrameworkType, path?: string, skipIde?: boolean): Promise<string> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework);

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

	const ideResults: InitStepResult[] = [];
	if (!skipIde) {
		ideResults.push(await configureZed(projectRoot));
		const extensionsDir = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "extensions", "vscode");
		ideResults.push(await configureVscode(extensionsDir));
	}

	const allResults = [methodologyResult, ...docResults, ...commandResults, ...agentResults, ...skillResults, mcpResult, ...ideResults];
	const allExist = allResults.every((r) => r.status === "exists" || r.status === "skipped");

	if (allExist) {
		return `AIDE already initialized (${config.framework} framework detected).\n\nAll components present:\n${allResults.map((r) => `  - ${r.name}`).join("\n")}\n\nRun aide_discover to see existing specs.`;
	}

	const lines = allResults.map((r) => {
		const done = r.status === "exists" || r.status === "skipped";
		const label = r.status === "created" ? "Created" : r.status === "installed" ? "Installed" : r.status === "wired" ? "Wired" : r.status === "skipped" ? "Skipped" : "Already exists";
		return `  ${done ? "-" : "\u2713"} ${r.name}: ${label}`;
	});
	const createdCommands = commandResults.filter((r) => r.status === "created").map((r) => r.name);

	return `AIDE initialized (${config.framework} framework):\n\n${lines.join("\n")}\n\nConfig: ${config.configPath}\nDoc hub: ${config.docHubDir}\nCommands: ${config.commandDir}\nMCP: ${config.mcpConfigPath}${createdCommands.length > 0 ? `\n\nNew commands: ${createdCommands.join(", ")}` : ""}\n\nNext steps: run aide_discover to see existing specs, or /aide:research to start a new one.`;
}
