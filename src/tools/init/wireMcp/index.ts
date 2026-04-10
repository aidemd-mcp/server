import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Wire the MCP server into the project's MCP config. */
export default async function wireMcp(mcpConfigPath: string): Promise<InitStepResult> {
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
