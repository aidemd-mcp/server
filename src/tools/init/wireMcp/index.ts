import { readFile } from "node:fs/promises";
import type { InitStep, McpPrescription } from "@/types/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Build the MCP server entry using the cmd /c npx form. */
export function mcpEntry(): McpPrescription["entry"] {
	return { command: "cmd", args: ["/c", "npx", "@aidemd-mcp/server"] };
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
			return {
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		} catch {
			return {
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				configMalformed: true,
			};
		}
	}

	return {
		name: "MCP config (aide)",
		status: "would-create",
		category: "mcp",
		filePath: mcpConfigPath,
		prescription,
	};
}
