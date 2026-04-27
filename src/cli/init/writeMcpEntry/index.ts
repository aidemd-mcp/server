import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";
import sharedWriteMcpEntry from "@/cli/shared/writeMcpEntry/index.js";
import type { McpServerEntry } from "@/types/index.js";

export interface WriteMcpEntryResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Thin wrapper around the shared `writeMcpEntry` helper that builds the MCP
 * entries map for the cold-start CLI and maps the shared helper's result to
 * the CLI's `WriteMcpEntryResult` shape.
 *
 * Pipeline:
 * 1. Computes the `aide` entry via `mcpEntry()`.
 * 2. When `vaultPath` is supplied:
 *    - Computes the canonical Obsidian brain.aide template content for the brain root path.
 *    - If `.aide/config/brain.aide` exists on disk, reads it (user edits win
 *      over the template). Otherwise uses the in-memory template content.
 *      The file lives inside the user-owned `.aide/config/` directory; this
 *      wrapper never writes to that path — only the orchestrator's
 *      seed-semantic scaffold step (Step 1 of runInit) writes it.
 *    - Parses the content via `parseBrainAideFromString`. On `ok`, derives
 *      the `brain` entry. On any non-ok kind, throws — a hand-edited
 *      brain.aide that doesn't parse is a user error to surface.
 *    - Adds `brain: brainEntry` and `obsidian: "delete"` to the entries map
 *      (legacy key migration, uniform with sync).
 * 3. When `vaultPath` is absent: only `aide` is in the entries map — the
 *    caller's deferred-categories messaging handles the brain followup.
 * 4. Delegates to the shared helper, then maps the result to the CLI shape:
 *    - `unchanged: true` and no writes → `{ status: "exists", ... }`.
 *    - Otherwise → `{ status: "created", message: <composed from written + deleted> }`.
 *
 * This helper only mutates `.mcp.json`. Writing `.aide/config/brain.aide` is
 * `runInit`'s responsibility (Step 1), not this helper's.
 *
 * Throws on malformed JSON — the only abort trigger for the CLI.
 */
export default async function writeMcpEntry(
	projectRoot: string,
	vaultPath?: string,
): Promise<WriteMcpEntryResult> {
	const entries: Record<string, McpServerEntry | "delete"> = {
		aide: mcpEntry(),
	};

	if (vaultPath !== undefined) {
		// Compute the canonical template content for this brain root path.
		const templateContent = obsidianBrainAideTemplate(vaultPath);

		// If brain.aide already exists on disk, use the user's version; otherwise
		// fall back to the in-memory template (handles first-run and re-run cases).
		const brainAidePath = join(projectRoot, ".aide", "config", "brain.aide");
		let brainAideContent: string;
		try {
			brainAideContent = await readFile(brainAidePath, "utf-8");
		} catch (err: unknown) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				brainAideContent = templateContent;
			} else {
				throw err;
			}
		}

		// Parse the brain.aide content. Any non-ok result is a user error to surface.
		const parseResult = parseBrainAideFromString(brainAideContent);
		if (parseResult.kind !== "ok") {
			const reason = parseResult.kind === "missing" ? "missing" : parseResult.reason;
			throw new Error(
				`.aide/config/brain.aide could not be parsed: ${reason}. Fix the file and re-run.`,
			);
		}

		const { config } = parseResult;
		const brainEntry: McpServerEntry = {
			command: config.mcpServerConfig.command,
			args: interpolateArgs(config),
		};

		entries.brain = brainEntry;
		// Migrate legacy obsidian key — uniform with sync's behavior.
		entries.obsidian = "delete";
	}

	const result = await sharedWriteMcpEntry(projectRoot, entries);

	if (result.unchanged) {
		return {
			status: "exists",
			message: "aide and brain MCP server entries already configured",
		};
	}

	// Compose the message from written and deleted keys.
	const { written, deleted } = result;

	// Count preserved (non-managed) servers by reading the current .mcp.json.
	// We need the preserved count for the "merged with N existing server(s)" suffix.
	// Re-read the file that was just written to get the full server map.
	const managedKeys = new Set(["aide", "aidemd-mcp", "brain", "obsidian"]);
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

	const parts: string[] = [];
	if (written.length > 0) {
		const entryWord = written.length === 1 ? "entry" : "entries";
		parts.push(`${written.join(" and ")} MCP server ${entryWord}`);
	}
	if (deleted.length > 0) {
		parts.push(`removed legacy ${deleted.join(", ")} key${deleted.length === 1 ? "" : "s"}`);
	}

	let message = parts.join("; ");

	if (preservedCount > 0) {
		message += ` (merged with ${preservedCount} existing server${preservedCount === 1 ? "" : "s"})`;
	}

	return { status: "created", message };
}
