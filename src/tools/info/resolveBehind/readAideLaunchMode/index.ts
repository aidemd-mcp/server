import { readFile } from "node:fs/promises";
import { join } from "node:path";
import detectFramework from "@/service/install/detectFramework/index.js";
import detectLaunchMode from "@/service/install/shared/detectLaunchMode/index.js";
import type { LaunchMode } from "@/types/index.js";

type McpEntry = { command: unknown; args: unknown };

/**
 * Read the host's MCP config and classify how its aide server entry is
 * launched. Looks up `mcpServers.aide`, falling back to the legacy
 * `mcpServers["aidemd-mcp"]` key. Returns null when the file is absent or
 * malformed, or when no aide entry exists. Never throws.
 */
export default async function readAideLaunchMode(root: string): Promise<LaunchMode | null> {
	try {
		const { mcpConfigPath } = await detectFramework(root);
		const raw = await readFile(join(root, mcpConfigPath), "utf-8");
		const config = JSON.parse(raw) as { mcpServers?: Record<string, McpEntry> } | null;
		const entry = config?.mcpServers?.aide ?? config?.mcpServers?.["aidemd-mcp"];
		if (!entry || typeof entry !== "object") return null;
		return detectLaunchMode(entry);
	} catch {
		return null;
	}
}
