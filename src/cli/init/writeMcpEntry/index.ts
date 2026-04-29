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
 * 2. Derives the brain MCP entry — always present under the always-scaffold
 *    contract:
 *    - Attempts to read `.aide/config/brain.aide` from disk. User edits win
 *      over the template: if the file exists, its bytes are the source of truth.
 *    - On ENOENT, falls back to the in-memory template generated from `brainPath`
 *      (or `obsidianBrainAideTemplate(undefined)` when `brainPath` is absent, which
 *      produces the `<BRAIN_PATH>` placeholder template). This fallback is
 *      defense-in-depth for non-CLI callers that have not pre-written brain.aide;
 *      the cold-start CLI (`runInit`) always pre-writes the file before this helper
 *      runs, so the ENOENT branch is unreachable on the CLI path.
 *      The file lives inside the user-owned `.aide/config/` directory; this
 *      wrapper never writes to that path — only the orchestrator's
 *      seed-semantic scaffold step (Step 1 of runInit) writes it.
 *    - Parses the content via `parseBrainAideFromString`. On `ok`, derives
 *      the `brain` entry via `parseResult.name` / `parseResult.mcpServerConfig`
 *      (the flattened ok shape — no `.config` wrapper). On any non-ok kind,
 *      throws — a hand-edited brain.aide that doesn't parse is a user error
 *      to surface.
 *    - Adds `brain: brainEntry` and `obsidian: "delete"` to the entries map
 *      (legacy key migration, uniform with sync).
 * 3. Delegates to the shared helper, then maps the result to the CLI shape:
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
	brainPath?: string,
): Promise<WriteMcpEntryResult> {
	const entries: Record<string, McpServerEntry | "delete"> = {
		aide: mcpEntry(),
	};

	// Derive the brain entry unconditionally — brain.aide is always on disk
	// under the always-scaffold contract. `brainPath` is retained solely for
	// the ENOENT fallback template (defense-in-depth for non-CLI callers).
	const brainAidePath = join(projectRoot, ".aide", "config", "brain.aide");
	let brainAideContent: string;
	try {
		brainAideContent = await readFile(brainAidePath, "utf-8");
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			// Fallback for non-CLI callers; the cold-start CLI always pre-writes
			// the file before this helper runs.
			brainAideContent = obsidianBrainAideTemplate(brainPath);
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

	const brainEntry: McpServerEntry = {
		command: parseResult.mcpServerConfig.command,
		args: interpolateArgs({ name: parseResult.name, mcpServerConfig: parseResult.mcpServerConfig }),
	};

	entries.brain = brainEntry;
	// Migrate legacy obsidian key — uniform with sync's behavior.
	entries.obsidian = "delete";

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
