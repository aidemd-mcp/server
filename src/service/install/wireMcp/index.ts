import { readFile } from "node:fs/promises";
import { platform } from "node:os";
import type { InitStep, McpPrescription } from "@/types/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Build the MCP server entry for the current platform.
 *
 * On Windows, `npx` must be invoked through `cmd /c` so that the shell can
 * resolve the `.cmd` shim. On macOS and Linux, `npx` can be invoked directly.
 */
export function mcpEntry(): McpPrescription["entry"] {
	if (platform() === "win32") {
		return { command: "cmd", args: ["/c", "npx", "@aidemd-mcp/server"] };
	}
	return { command: "npx", args: ["@aidemd-mcp/server"] };
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
