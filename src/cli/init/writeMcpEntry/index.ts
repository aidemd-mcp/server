import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mcpEntry } from "@/tools/init/wireMcp/index.js";

export interface WriteMcpEntryResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Read-parse-merge-write for `.mcp.json` in the given project root.
 *
 * Returns `exists` when the aide entry is already present (dual-key check:
 * `aide` or `aidemd-mcp`). Returns `created` after merging and writing the
 * new entry. Throws on malformed JSON or write failure.
 */
export default async function writeMcpEntry(
	projectRoot: string,
): Promise<WriteMcpEntryResult> {
	const mcpPath = join(projectRoot, ".mcp.json");

	let existing: string;
	try {
		existing = await readFile(mcpPath, "utf-8");
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			existing = "";
		} else {
			throw err;
		}
	}

	let config: Record<string, unknown> = {};

	if (existing) {
		try {
			config = JSON.parse(existing) as Record<string, unknown>;
		} catch {
			throw new Error(
				`.mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.`,
			);
		}
	}

	const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

	if ("aide" in servers || "aidemd-mcp" in servers) {
		return { status: "exists", message: "aide server already configured" };
	}

	const existingCount = Object.keys(servers).length;

	const merged: Record<string, unknown> = {
		...config,
		mcpServers: {
			...servers,
			aide: mcpEntry(),
		},
	};

	await writeFile(mcpPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

	const message =
		existingCount > 0
			? `aide MCP server entry (merged with ${existingCount} existing server${existingCount === 1 ? "" : "s"})`
			: "aide MCP server entry";

	return { status: "created", message };
}
