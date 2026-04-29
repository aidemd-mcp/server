import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import sharedWriteMcpEntry from "@/cli/shared/writeMcpEntry/index.js";
import type { McpServerEntry } from "@/types/index.js";

export interface WriteMcpEntryResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Writes ONLY the `aide` key into `.mcp.json` via the shared additive-merge writer.
 *
 * This helper NEVER reads `.aide/config/brain.aide`, NEVER derives a brain entry,
 * NEVER writes a `brain` key, NEVER writes or deletes a legacy `obsidian` key.
 * cli/init does not migrate legacy keys. The only mutation surface for
 * `mcpServers.brain` is cli/sync (invoked from `/aide:brain config`). Pre-rework
 * hosts carry a legacy `obsidian` key as user data forever, untouched by cli/init.
 *
 * Throws on malformed `.mcp.json` — the only abort trigger for cli/init.
 *
 * Idempotent: re-running on a project where the `aide` entry is already present
 * returns `{ status: "exists", message: "aide MCP server entry already configured" }`
 * with no write.
 *
 * @param projectRoot - The project root containing `.mcp.json`.
 */
export default async function writeMcpEntry(
	projectRoot: string,
): Promise<WriteMcpEntryResult> {
	const entries: Record<string, McpServerEntry | "delete"> = {
		aide: mcpEntry(),
	};

	const result = await sharedWriteMcpEntry(projectRoot, entries);

	if (result.unchanged) {
		return {
			status: "exists",
			message: "aide MCP server entry already configured",
		};
	}

	// Count preserved (non-managed) servers by reading the current .mcp.json.
	// Re-read the file that was just written to get the full server map.
	const managedKeys = new Set(["aide", "aidemd-mcp"]);
	let preservedCount = 0;
	try {
		const mcpPath = join(projectRoot, ".mcp.json");
		const raw = await readFile(mcpPath, "utf-8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
		preservedCount = Object.keys(servers).filter((k) => !managedKeys.has(k)).length;
	} catch {
		// If reading fails after the write, preserve count stays 0 — non-fatal.
	}

	let message = "aide MCP server entry";

	if (preservedCount > 0) {
		message += ` (merged with ${preservedCount} existing server${preservedCount === 1 ? "" : "s"})`;
	}

	return { status: "created", message };
}
