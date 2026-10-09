import { readFile } from "node:fs/promises";
import type { McpPrescription, UpgradeFileResult } from "@/types/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import detectLaunchMode from "@/service/install/shared/detectLaunchMode/index.js";
import normalizeLaunchedCommand from "@/service/install/shared/normalizeLaunchedCommand/index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import isCanonicalGlobalAideEntry from "./isCanonicalGlobalAideEntry/index.js";

/** Informational note for a global aide entry launched by absolute path. Neither drift nor a prescription. */
const ABSOLUTE_PATH_TIP =
	"The aide entry launches the global install by absolute path. A bare `aidemd-mcp` command is more portable if `.mcp.json` is committed.";

/** Read a file, returning undefined if it does not exist. */
async function safeReadFile(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Judge the `aide` / `aidemd-mcp` key in an MCP config file. Read-only — never writes.
 *
 * Only AIDE's own launch forms are judged; a custom entry (any other launched
 * program) is the user's and is left alone, reported as `"matches"` with no
 * prescription. An npx entry matches only when it equals the pinned local entry,
 * so an older or unpinned pin is drift: that is how the pin moves forward. An
 * `aidemd-mcp` entry matches as the bare name or an absolute-path shim (the path
 * form adds an informational `tip`). The check never proposes switching modes
 * and never touches the brain launcher.
 *
 * Returns an `UpgradeFileResult` with category `"mcp"`:
 * - `"malformed"` when the file exists but is not valid JSON.
 * - `"missing"` when the file does not exist. `prescription` carries the
 *   local server entry for the agent to merge.
 * - `"matches"` when the aide entry is canonical in its own mode, or custom.
 * - `"differs"` when the aide entry is absent or drifted. `prescription`
 *   carries the entry, in the detected mode, for the agent to merge.
 *
 * The legacy `"aidemd-mcp"` key (old unscoped package) is detected as
 * `"differs"` so the agent can migrate it to the canonical `"aide"` key.
 */
export default async function checkMcpConfig(
	mcpConfigPath: string,
): Promise<UpgradeFileResult> {
	const name = "MCP config";
	const localPrescription: McpPrescription = { key: "aide", entry: mcpEntry("local") };

	const existing = await safeReadFile(mcpConfigPath);

	if (existing === undefined) {
		return {
			name,
			filePath: mcpConfigPath,
			status: "missing",
			category: "mcp",
			prescription: localPrescription,
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

	if (aideEntry === undefined || aideEntry === null || typeof aideEntry !== "object") {
		return {
			name,
			filePath: mcpConfigPath,
			status: "differs",
			category: "mcp",
			prescription: localPrescription,
		};
	}

	const launched = normalizeLaunchedCommand({ command: aideEntry.command, args: aideEntry.args });
	const prescription: McpPrescription = {
		key: "aide",
		entry: mcpEntry(detectLaunchMode({ command: aideEntry.command, args: aideEntry.args })),
	};
	const differs: UpgradeFileResult = {
		name,
		filePath: mcpConfigPath,
		status: "differs",
		category: "mcp",
		prescription,
	};
	const matches: UpgradeFileResult = {
		name,
		filePath: mcpConfigPath,
		status: "matches",
		category: "mcp",
	};

	if (hasLegacyKey) return differs;

	if (launched?.token === "npx") {
		const pinned = mcpEntry("local");
		const isPinned =
			aideEntry.command === pinned.command &&
			Array.isArray(aideEntry.args) &&
			aideEntry.args.length === pinned.args.length &&
			pinned.args.every((a, i) => (aideEntry.args as unknown[])[i] === a);
		return isPinned ? matches : differs;
	}

	if (launched?.token === aidePackage.command) {
		if (!isCanonicalGlobalAideEntry({ command: aideEntry.command, args: aideEntry.args })) return differs;
		return launched.viaPath ? { ...matches, tip: ABSOLUTE_PATH_TIP } : matches;
	}

	return matches;
}
