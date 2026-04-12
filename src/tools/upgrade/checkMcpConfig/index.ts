import { readFile } from "node:fs/promises";
import type { McpPrescription, UpgradeFileResult } from "@/types/index.js";

/** Canonical aide server entry that upgrade checks and reports. */
const CANONICAL_AIDE_SERVER: McpPrescription["entry"] = {
	command: "npx",
	args: ["@aidemd-mcp/server"],
};

/** Read a file, returning undefined if it does not exist. */
async function safeReadFile(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Compare the `aide` / `aidemd-mcp` key in an MCP config file against the
 * canonical shape. Read-only — never writes.
 *
 * Returns an `UpgradeFileResult` with category `"mcp"`:
 * - `"malformed"` when the file exists but is not valid JSON.
 * - `"missing"` when the file does not exist. `prescription` carries the
 *   canonical server entry for the agent to merge.
 * - `"matches"` when the aide entry already matches canonical.
 * - `"differs"` when the aide entry is absent or differs. `prescription`
 *   carries the canonical server entry for the agent to merge.
 *
 * The legacy `"aidemd-mcp"` key (old unscoped package) is detected as
 * `"differs"` so the agent can migrate it to the canonical `"aide"` key.
 */
export default async function checkMcpConfig(
	mcpConfigPath: string,
): Promise<UpgradeFileResult> {
	const name = "MCP config";
	const prescription: McpPrescription = { key: "aide", entry: CANONICAL_AIDE_SERVER };

	const existing = await safeReadFile(mcpConfigPath);

	if (existing === undefined) {
		return {
			name,
			filePath: mcpConfigPath,
			status: "missing",
			category: "mcp",
			prescription,
		};
	}

	let config: Record<string, unknown>;
	try {
		config = JSON.parse(existing) as Record<string, unknown>;
	} catch {
		return {
			name,
			filePath: mcpConfigPath,
			status: "malformed",
			category: "mcp",
		};
	}

	const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

	// Check both key names init may have used.
	const hasLegacyKey = "aidemd-mcp" in servers;
	const aideEntry = ("aide" in servers ? servers["aide"] : servers["aidemd-mcp"]) as
		| { command?: unknown; args?: unknown }
		| undefined;

	const isCanonical =
		!hasLegacyKey &&
		aideEntry !== undefined &&
		aideEntry.command === CANONICAL_AIDE_SERVER.command &&
		Array.isArray(aideEntry.args) &&
		aideEntry.args.length === CANONICAL_AIDE_SERVER.args.length &&
		CANONICAL_AIDE_SERVER.args.every((a, i) => (aideEntry.args as unknown[])[i] === a);

	if (isCanonical) {
		return {
			name,
			filePath: mcpConfigPath,
			status: "matches",
			category: "mcp",
		};
	}

	return {
		name,
		filePath: mcpConfigPath,
		status: "differs",
		category: "mcp",
		prescription,
	};
}
