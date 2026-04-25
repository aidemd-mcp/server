import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import { obsidianMcpEntry } from "@/service/install/provisionBrain/index.js";

export interface WriteMcpEntryResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Read-parse-merge-write for `.mcp.json` in the given project root.
 *
 * Writes the `aide` and `brain` MCP server entries additively.
 * The aide entry is pure canonical. The brain entry is written with
 * `vaultPath` when provided, or an empty string placeholder when not —
 * an empty path is intentional: `aide_info` reports it as `invalid-path`,
 * which the orchestrator's inline-recovery flow (open Claude Code and run
 * `/aide`) detects and prompts the user to fill in the real vault path.
 *
 * Brain entry migration semantics (mirrors `buildBrainMcpStep` in provisionBrain):
 *
 * - Cold install (no `obsidian` key, no `brain` key) → write under `brain`.
 * - Legacy (`obsidian` exists, `brain` does not) → write under `brain`.
 *   The `obsidian` orphan key is preserved; cleanup is deferred to a
 *   separate follow-up step.
 * - Transitional (both `obsidian` and `brain` exist) → leave alone, no
 *   brain write needed. The brain key is already present.
 * - Already-current (`brain` exists, no `obsidian`) → leave alone.
 *
 * The `aide` entry follows the original never-overwrite semantics: if
 * `aide` (or legacy `aidemd-mcp`) is present, it is preserved.
 *
 * Returns `exists` only when BOTH aide and brain are already present.
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
	const brainPresent = "brain" in servers;
	const obsidianPresent = "obsidian" in servers;

	// Transitional or already-current: brain key is already present.
	// Aide key check is still independent — aide may still need to be written.
	if (brainPresent && aidePresent) {
		return {
			status: "exists",
			message: "aide and brain MCP server entries already configured",
		};
	}

	const nextServers: Record<string, unknown> = { ...servers };
	const added: string[] = [];

	if (!aidePresent) {
		nextServers.aide = mcpEntry();
		added.push("aide");
	}

	// Write brain when not already present (covers cold-install and legacy-obsidian branches).
	// When both obsidian and brain are already present (transitional), brainPresent is true
	// and we already returned `exists` above (when aide is also present) or fall through
	// to only add aide. When brain is absent but obsidian exists (legacy), we write brain.
	if (!brainPresent) {
		nextServers.brain = obsidianMcpEntry(vaultPath ?? "");
		added.push("brain");
	}

	if (added.length === 0) {
		// aide is present, brain is present — both covered. Should not reach here
		// because brainPresent && aidePresent returns early above, but guard for safety.
		return {
			status: "exists",
			message: "aide and brain MCP server entries already configured",
		};
	}

	const merged: Record<string, unknown> = {
		...config,
		mcpServers: nextServers,
	};

	await writeFile(mcpPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

	// Count preserved servers: all servers except the managed keys (aide, aidemd-mcp, brain, obsidian).
	const managedKeys = new Set(["aide", "aidemd-mcp", "brain", "obsidian"]);
	const preservedCount = Object.keys(servers).filter((k) => !managedKeys.has(k)).length;
	const addedText = added.join(" and ");
	const base = `${addedText} MCP server ${added.length === 1 ? "entry" : "entries"}`;

	let message: string;
	if (preservedCount > 0) {
		message = `${base} (merged with ${preservedCount} existing server${preservedCount === 1 ? "" : "s"})`;
	} else {
		message = base;
	}
	if (!brainPresent && !vaultPath) {
		message += " — brain vault path is a placeholder; open Claude Code and run /aide to set it";
	}

	return { status: "created", message };
}
