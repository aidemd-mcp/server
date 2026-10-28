import { readFile } from "node:fs/promises";
import type { InitStep, McpPrescription } from "@/types/index.js";
import aidePackage from "../shared/aidePackage/index.js";
import checkGlobalPackage from "../shared/checkGlobalPackage/index.js";
import planInstallInstruction from "../shared/planInstallInstruction/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Report whether the aide package is installed globally, with the command that installs it. */
async function planGlobalPackage() {
	return {
		name: aidePackage.name,
		installed: await checkGlobalPackage(aidePackage.name),
		installCommand: aidePackage.installCommand,
	};
}

/**
 * Build the MCP server entry the install prescribes: the globally installed
 * bin by its bare name (`aidemd-mcp`, no args) on every platform, as verified
 * by the Windows launch probe. Never a machine-specific path.
 */
export function mcpEntry(): McpPrescription["entry"] {
	return { command: aidePackage.command, args: [] };
}

/**
 * Inspect the project's MCP config and return a planning step for the aide
 * server entry.
 *
 * Returns `exists` when an aide entry is already present. Returns
 * `would-create` with a McpPrescription when the entry is absent.
 * If the config file exists but contains malformed JSON, returns
 * `would-create` with `configMalformed: true` so the agent can surface
 * the issue to the user.
 *
 * Every `would-create` result also carries `globalPackage` (whether the
 * package is installed globally, and the command that installs it): the global
 * install is a setup step the consumer runs before writing the entry. The
 * `exists` result never does, and never runs the npm check. An absent-entry
 * `would-create` whose package is not installed also carries `instructions`
 * telling the agent to run the install before merging, and not to merge if it
 * fails; a malformed config never does.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function wireMcp(mcpConfigPath: string): Promise<InitStep> {
	const prescription: McpPrescription = { key: "aide", entry: mcpEntry() };
	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("aide" in servers || "aidemd-mcp" in servers) {
				return {
					name: "MCP config (aide)",
					status: "exists",
					category: "mcp",
					filePath: mcpConfigPath,
				};
			}
		} catch {
			return {
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				configMalformed: true,
				globalPackage: await planGlobalPackage(),
			};
		}
	}

	const globalPackage = await planGlobalPackage();
	const instructions = planInstallInstruction(globalPackage);
	return {
		name: "MCP config (aide)",
		status: "would-create",
		category: "mcp",
		filePath: mcpConfigPath,
		prescription,
		globalPackage,
		...(instructions && { instructions }),
	};
}
