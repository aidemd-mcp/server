import { readFile } from "node:fs/promises";
import { platform } from "node:os";
import type { InitStep, LaunchMode, McpPrescription } from "@/types/index.js";
import aidePackage from "../shared/aidePackage/index.js";
import checkGlobalPackage from "../shared/checkGlobalPackage/index.js";
import readAidePackageVersion from "../shared/readAidePackageVersion/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Build the MCP server entry for the given launch mode on the current platform.
 *
 * Local (the default) launches through `npx -y`, pinned to the version of the
 * running package (`@aidemd-mcp/server@<version>`, never `@latest`); `-y`
 * suppresses npx install prompts. On Windows, `npx` must be invoked through
 * `cmd /c` so that the shell can resolve the `.cmd` shim. On macOS and Linux,
 * `npx` can be invoked directly.
 *
 * Global launches the installed bin by its bare name on every platform
 * (`aidemd-mcp`, no args), as verified by the Windows launch probe.
 */
export function mcpEntry(mode: LaunchMode = "local"): McpPrescription["entry"] {
	if (mode === "global") {
		return { command: aidePackage.command, args: [] };
	}
	const spec = `${aidePackage.name}@${readAidePackageVersion()}`;
	if (platform() === "win32") {
		return { command: "cmd", args: ["/c", "npx", "-y", spec] };
	}
	return { command: "npx", args: ["-y", spec] };
}

/**
 * Inspect the project's MCP config and return a planning step for the aide
 * server entry.
 *
 * Returns `exists` when an aide entry is already present. Returns
 * `would-create` with a McpPrescription when the entry is absent.
 * If the config file exists but contains malformed JSON, returns
 * `would-create` with `configMalformed: true` so the agent can surface
 * the issue to the user.
 *
 * In global mode every `would-create` result also carries `globalPackage`
 * (whether the package is installed globally, and the command that installs
 * it). The `exists` result never does.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function wireMcp(
	mcpConfigPath: string,
	mode: LaunchMode = "local",
): Promise<InitStep> {
	const prescription: McpPrescription = { key: "aide", entry: mcpEntry(mode) };
	const globalPackage =
		mode === "global"
			? {
					name: aidePackage.name,
					installed: await checkGlobalPackage(aidePackage.name),
					installCommand: aidePackage.installCommand,
				}
			: undefined;
	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("aide" in servers || "aidemd-mcp" in servers) {
				return {
					name: "MCP config (aide)",
					status: "exists",
					category: "mcp",
					filePath: mcpConfigPath,
				};
			}
			return {
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				...(globalPackage && { globalPackage }),
			};
		} catch {
			return {
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				configMalformed: true,
				...(globalPackage && { globalPackage }),
			};
		}
	}

	return {
		name: "MCP config (aide)",
		status: "would-create",
		category: "mcp",
		filePath: mcpConfigPath,
		prescription,
		...(globalPackage && { globalPackage }),
	};
}
