import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServerEntry } from "@/types/index.js";

/**
 * Result returned by writeMcpEntry after a successful mutation pass.
 */
export interface WriteMcpEntryResult {
	/** Keys that were written (new or updated) in this call. */
	written: string[];
	/** Keys that were removed in this call. */
	deleted: string[];
	/**
	 * True when no write happened because the file was already structurally
	 * identical to the desired state. Both `written` and `deleted` are empty
	 * when this is true.
	 */
	unchanged: boolean;
}

/**
 * Structural equality check for two McpServerEntry objects.
 *
 * Compares `command` with string equality and `args` element-by-element.
 * Does NOT serialize and byte-compare — two entries that produce the same
 * JSON bytes but differ in property order would still be considered equal
 * by this check, which is the desired behaviour for change detection.
 */
function entriesEqual(a: McpServerEntry, b: McpServerEntry): boolean {
	if (a.command !== b.command) return false;
	if (a.args.length !== b.args.length) return false;
	for (let i = 0; i < a.args.length; i++) {
		if (a.args[i] !== b.args[i]) return false;
	}
	return true;
}

/**
 * Generalised read-parse-merge-write helper for `.mcp.json`.
 *
 * Takes a map of desired mutations and applies them atomically in a single
 * file write. The `entries` map mixes set operations (an entry object) and
 * delete operations (the sentinel string `"delete"`) in one call:
 *
 * ```ts
 * await writeMcpEntry(projectRoot, {
 *   brain: { command: "npx", args: ["-y", "obsidian-mcp", "/vault"] },
 *   obsidian: "delete",
 * });
 * ```
 *
 * Load-bearing invariants:
 * - Never throws on a missing `.mcp.json` — creates the file on first write.
 * - Throws `Error(".mcp.json exists but contains invalid JSON. Fix the syntax
 *   error and re-run.")` when the file exists but cannot be parsed as JSON.
 *   Other I/O errors (permissions, etc.) are re-thrown unchanged.
 * - Preserves every key in `mcpServers` that is NOT named in `entries`.
 * - Preserves every top-level key outside `mcpServers`.
 * - Uses structural equality (not byte comparison) for change detection:
 *   a key is considered unchanged when `command` and each `args` element
 *   match string-for-string.
 * - Deleting a key that is absent is a no-op — it does not trigger a write.
 * - Returns `{ written: [], deleted: [], unchanged: true }` when no mutation
 *   is needed (already in sync).
 *
 * @param projectRoot  Absolute path to the host project root. `.mcp.json`
 *                     is resolved as `join(projectRoot, ".mcp.json")`.
 * @param entries      Map of key → entry (set) or key → `"delete"` (remove).
 */
export default async function writeMcpEntry(
	projectRoot: string,
	entries: Record<string, McpServerEntry | "delete">,
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

	const currentServers = (config.mcpServers ?? {}) as Record<string, unknown>;
	const nextServers: Record<string, unknown> = { ...currentServers };

	const written: string[] = [];
	const deleted: string[] = [];

	for (const [key, value] of Object.entries(entries)) {
		if (value === "delete") {
			if (key in nextServers) {
				delete nextServers[key];
				deleted.push(key);
			}
		} else {
			const existing = currentServers[key] as McpServerEntry | undefined;
			if (existing && entriesEqual(existing, value)) {
				// Already in sync — skip this key.
				continue;
			}
			nextServers[key] = value;
			written.push(key);
		}
	}

	if (written.length === 0 && deleted.length === 0) {
		return { written: [], deleted: [], unchanged: true };
	}

	const merged: Record<string, unknown> = {
		...config,
		mcpServers: nextServers,
	};

	await writeFile(mcpPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

	return { written, deleted, unchanged: false };
}
