import { readFile } from "node:fs/promises";
import type { GlobalPackageStatus, UpgradeFileResult } from "@/types/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import normalizeLaunchedCommand from "@/service/install/shared/normalizeLaunchedCommand/index.js";
import planInstallInstruction from "@/service/install/shared/planInstallInstruction/index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import readAidePin from "../shared/readAidePin/index.js";
import isCanonicalGlobalAideEntry from "./isCanonicalGlobalAideEntry/index.js";
import isPinBehind from "./isPinBehind/index.js";

/** Instructions for a local aide entry whose version pin cannot be located, so it cannot be moved to `target`. */
const UNLOCATABLE_PIN = (target: string): string =>
	`The aide entry runs npx in a form whose version pin cannot be located (another package, or a -p/--package flag), so it cannot be moved to ${target}. Leave the entry as it is and tell the user.`;

/** Instructions for an npx aide entry under the `aidemd-mcp` key when a version pin move is requested: the pin move only addresses the `aide` key. */
const LEGACY_KEY_PIN =
	"The aide entry is under the `aidemd-mcp` key, whose version pin this tool does not move. Call aide_upgrade without targetVersion to switch it to the global `aidemd-mcp` command instead.";

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

/** Report whether the aide package is installed globally, with the command that installs it. */
async function readGlobalPackage(): Promise<GlobalPackageStatus> {
	return {
		name: aidePackage.name,
		installed: await checkGlobalPackage(aidePackage.name),
		installCommand: aidePackage.installCommand,
	};
}

/**
 * Judge the `aide` / `aidemd-mcp` key in an MCP config file. Read-only — never writes.
 *
 * The global form is canonical: an entry launching the `aidemd-mcp` bin matches
 * under either key, so the key alone is never drift. An npx entry is drift
 * toward the global form, reported as a `globalSwitch` (which key holds it,
 * whether the package is installed globally, and the install command) for the
 * tool to write once the package is installed; it is never returned as a
 * prescription for the agent to merge. A custom entry (any other launched
 * program) is the user's and is left alone, reported as `"matches"`. An
 * `aidemd-mcp` entry matches as the bare name or an absolute-path shim (the
 * path form adds an informational `tip`); extra args are drift with a global
 * prescription. The brain launcher is never touched.
 *
 * With a `targetVersion`, an npx entry under the `aide` key is judged by its
 * version pin alone: drift is reported as `pinMove` for the tool to write, and
 * an entry whose pin cannot be located gets `instructions` instead. An npx entry
 * under the `aidemd-mcp` key gets `instructions` pointing at the switch, since
 * the pin move does not address that key.
 *
 * The npm global check (`npm root -g`) runs only for a missing file, an absent
 * entry or an npx entry without a `targetVersion`.
 *
 * Returns an `UpgradeFileResult` with category `"mcp"`:
 * - `"malformed"` when the file exists but is not valid JSON.
 * - `"missing"` when the file does not exist. `prescription` carries the global
 *   server entry for the agent to merge, with `globalPackage` beside it. When the
 *   package is not installed, `instructions` also tells the agent to run the
 *   install before merging, and not to merge if it fails.
 * - `"matches"` when the aide entry is canonical, or custom.
 * - `"differs"` when the aide entry is absent (global `prescription` plus
 *   `globalPackage`, and the same install-first `instructions` when the package
 *   is not installed), an npx entry (`globalSwitch`), or a non-canonical
 *   `aidemd-mcp` entry (global `prescription`).
 */
export default async function checkMcpConfig(
	mcpConfigPath: string,
	targetVersion?: string,
): Promise<UpgradeFileResult> {
	const name = "MCP config";

	const existing = await safeReadFile(mcpConfigPath);

	if (existing === undefined) {
		const globalPackage = await readGlobalPackage();
		const instructions = planInstallInstruction(globalPackage);
		return {
			name,
			filePath: mcpConfigPath,
			status: "missing",
			category: "mcp",
			prescription: { key: "aide", entry: mcpEntry() },
			globalPackage,
			...(instructions !== undefined && { instructions }),
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

	// The entry lives under whichever key init used; "aide" wins when both exist.
	const key = "aide" in servers ? "aide" : "aidemd-mcp";
	const aideEntry = servers[key] as { command?: unknown; args?: unknown } | undefined;

	if (aideEntry === undefined || aideEntry === null || typeof aideEntry !== "object") {
		const globalPackage = await readGlobalPackage();
		const instructions = planInstallInstruction(globalPackage);
		return {
			name,
			filePath: mcpConfigPath,
			status: "differs",
			category: "mcp",
			prescription: { key: "aide", entry: mcpEntry() },
			globalPackage,
			...(instructions !== undefined && { instructions }),
		};
	}

	const launched = normalizeLaunchedCommand({ command: aideEntry.command, args: aideEntry.args });
	const matches: UpgradeFileResult = {
		name,
		filePath: mcpConfigPath,
		status: "matches",
		category: "mcp",
	};

	if (launched?.token === "npx") {
		if (targetVersion === undefined) {
			return {
				name,
				filePath: mcpConfigPath,
				status: "differs",
				category: "mcp",
				globalSwitch: { key, ...(await readGlobalPackage()) },
			};
		}

		if (key === "aidemd-mcp") {
			return {
				name,
				filePath: mcpConfigPath,
				status: "differs",
				category: "mcp",
				instructions: LEGACY_KEY_PIN,
			};
		}

		const pin = readAidePin(aideEntry);
		if (pin === null) {
			return {
				name,
				filePath: mcpConfigPath,
				status: "differs",
				category: "mcp",
				instructions: UNLOCATABLE_PIN(targetVersion),
			};
		}
		if (!isPinBehind(pin.version, targetVersion)) return matches;
		return {
			name,
			filePath: mcpConfigPath,
			status: "differs",
			category: "mcp",
			pinMove: { from: pin.version, to: targetVersion },
		};
	}

	if (launched?.token === aidePackage.command) {
		if (!isCanonicalGlobalAideEntry({ command: aideEntry.command, args: aideEntry.args })) {
			return {
				name,
				filePath: mcpConfigPath,
				status: "differs",
				category: "mcp",
				prescription: { key: "aide", entry: mcpEntry() },
			};
		}
		return launched.viaPath ? { ...matches, tip: ABSOLUTE_PATH_TIP } : matches;
	}

	return matches;
}
