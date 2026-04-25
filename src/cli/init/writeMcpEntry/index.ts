import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mcpEntry } from "@/tools/init/wireMcp/index.js";
import { obsidianMcpEntry } from "@/tools/init/provisionBrain/index.js";

export interface WriteMcpEntryResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Read-parse-merge-write for `.mcp.json` in the given project root.
 *
 * Writes BOTH the `aide` and `obsidian` MCP server entries additively.
 * The aide entry is pure canonical. The obsidian entry is written with
 * `vaultPath` when provided, or an empty string placeholder when not —
 * an empty path is intentional: `aide_info` reports it as `invalid-path`,
 * which the orchestrator's inline-recovery flow (open Claude Code and run
 * `/aide`) detects and prompts the user to fill in the real vault path.
 *
 * Never overwrites existing entries. If `aide` (or legacy `aidemd-mcp`)
 * is present, it is preserved. If `obsidian` is present — even with a
 * different vault path, or with no path at all — it is preserved. A
 * second CLI run with `--vault-path` on top of an empty-path entry does
 * NOT update the path; the user fixes it via `/aide` (the orchestrator's
 * inline-recovery flow prompts for it) or by hand.
 *
 * Returns `exists` only when BOTH aide and obsidian are already present.
 * Otherwise returns `created` and the message names which entries were
 * added.
 *
 * Throws on malformed JSON — the only abort trigger for the CLI.
 */
export default async function writeMcpEntry(
	projectRoot: string,
	vaultPath?: string,
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

	const aidePresent = "aide" in servers || "aidemd-mcp" in servers;
	const obsidianPresent = "obsidian" in servers;

	if (aidePresent && obsidianPresent) {
		return {
			status: "exists",
			message: "aide and obsidian MCP server entries already configured",
		};
	}

	const nextServers: Record<string, unknown> = { ...servers };
	const added: string[] = [];
	if (!aidePresent) {
		nextServers.aide = mcpEntry();
		added.push("aide");
	}
	if (!obsidianPresent) {
		nextServers.obsidian = obsidianMcpEntry(vaultPath ?? "");
		added.push("obsidian");
	}

	const merged: Record<string, unknown> = {
		...config,
		mcpServers: nextServers,
	};

	await writeFile(mcpPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

	const preservedCount =
		Object.keys(servers).length - (aidePresent ? 1 : 0) - (obsidianPresent ? 1 : 0);
	const addedText = added.join(" and ");
	const base = `${addedText} MCP server ${added.length === 1 ? "entry" : "entries"}`;

	let message: string;
	if (preservedCount > 0) {
		message = `${base} (merged with ${preservedCount} existing server${preservedCount === 1 ? "" : "s"})`;
	} else {
		message = base;
	}
	if (!obsidianPresent && !vaultPath) {
		message += " — obsidian vault path is a placeholder; open Claude Code and run /aide to set it";
	}

	return { status: "created", message };
}
