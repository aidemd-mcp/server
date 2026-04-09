import { z } from "zod";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname, isAbsolute } from "node:path";
import type { FrameworkType, InitStepResult } from "../../types/index.js";
import detectFramework from "../../lib/detectFramework/index.js";
import { getMethodology, getMethodologyMarker, getCommands } from "../../lib/initContent/index.js";
import { configureZed, configureVscode } from "../../lib/configureIde/index.js";

export const InitInput = z.object({
	framework: z
		.enum(["claude", "cursor", "windsurf", "copilot"])
		.optional()
		.describe("Force a specific framework instead of auto-detecting"),
	path: z
		.string()
		.optional()
		.describe("Custom project root path (defaults to server working directory)"),
	skipIde: z
		.boolean()
		.optional()
		.describe("Skip IDE file association configuration (Zed settings, VS Code extension)"),
});

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Write methodology to the agent config file if not already present. */
async function writeMethodology(configPath: string): Promise<InitStepResult> {
	const existing = await safeReadFile(configPath);
	const marker = getMethodologyMarker();

	if (existing.includes(marker)) return { name: "Methodology", status: "exists" };

	const methodology = getMethodology();
	const content = existing ? `${existing}\n\n${methodology}\n` : `${methodology}\n`;

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, content, "utf-8");
	return { name: "Methodology", status: "created" };
}

/** Create slash command files, skipping any that already exist. */
async function scaffoldCommands(commandDir: string): Promise<InitStepResult[]> {
	const commands = getCommands();
	const results: InitStepResult[] = [];

	await mkdir(commandDir, { recursive: true });

	for (const [filename, content] of Object.entries(commands)) {
		const filePath = join(commandDir, filename);
		const name = filename.replace(".md", "");

		if (await fileExists(filePath)) {
			results.push({ name, status: "exists" });
		} else {
			await writeFile(filePath, content, "utf-8");
			results.push({ name, status: "created" });
		}
	}

	return results;
}

/** Wire the MCP server into the project's MCP config. */
async function wireMcp(mcpConfigPath: string): Promise<InitStepResult> {
	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("aide" in servers || "aidemd-mcp" in servers) {
				return { name: "MCP config", status: "exists" };
			}
			servers.aide = { command: "npx", args: ["aidemd-mcp"] };
			config.mcpServers = servers;
			await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
			return { name: "MCP config", status: "wired" };
		} catch {
			return { name: "MCP config", status: "skipped" };
		}
	}

	const config = { mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } };
	await mkdir(dirname(mcpConfigPath), { recursive: true });
	await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
	return { name: "MCP config", status: "wired" };
}

/**
 * Bootstrap the AIDE development environment into a project.
 * Detects the agent framework, writes methodology, scaffolds slash commands,
 * and wires the MCP config. Each step is idempotent.
 */
export default async function init(
	root: string,
	framework?: FrameworkType,
	path?: string,
	skipIde?: boolean,
): Promise<string> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework);

	const configPath = join(projectRoot, config.configPath);
	const commandDir = join(projectRoot, config.commandDir);
	const mcpConfigPath = join(projectRoot, config.mcpConfigPath);

	const methodologyResult = await writeMethodology(configPath);
	const commandResults = await scaffoldCommands(commandDir);
	const mcpResult = await wireMcp(mcpConfigPath);

	const ideResults: InitStepResult[] = [];
	if (!skipIde) {
		const zedResult = await configureZed(projectRoot);
		ideResults.push(zedResult);

		const extensionsDir = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "extensions", "vscode");
		const vscodeResult = await configureVscode(extensionsDir);
		ideResults.push(vscodeResult);
	}

	const allResults = [methodologyResult, ...commandResults, mcpResult, ...ideResults];
	const allExist = allResults.every((r) => r.status === "exists" || r.status === "skipped");

	if (allExist) {
		return `AIDE already initialized (${config.framework} framework detected).\n\nAll components present:\n${allResults.map((r) => `  - ${r.name}`).join("\n")}\n\nRun aide_discover to see existing specs.`;
	}

	const lines = allResults.map((r) => {
		const icon = r.status === "exists" || r.status === "skipped" ? "-" : "\u2713";
		const label =
			r.status === "created" ? "Created" : r.status === "installed" ? "Installed" : r.status === "wired" ? "Wired" : r.status === "skipped" ? "Skipped" : "Already exists";
		return `  ${icon} ${r.name}: ${label}`;
	});

	const createdCommands = commandResults.filter((r) => r.status === "created").map((r) => r.name);

	return `AIDE initialized (${config.framework} framework):\n\n${lines.join("\n")}\n\nConfig: ${config.configPath}\nCommands: ${config.commandDir}\nMCP: ${config.mcpConfigPath}${createdCommands.length > 0 ? `\n\nNew commands: ${createdCommands.join(", ")}` : ""}\n\nNext steps: run aide_discover to see existing specs, or /aide-research to start a new one.`;
}
