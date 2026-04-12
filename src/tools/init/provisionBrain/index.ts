import { readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import type { InitStep, McpPrescription } from "@/types/index.js";

/** Check if a path exists. */
async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** Check if a vault already exists at brainPath (.obsidian/ dir present, or directory is non-empty). */
async function vaultExists(brainPath: string): Promise<boolean> {
	if (await exists(join(brainPath, ".obsidian"))) return true;

	try {
		const entries = await readdir(brainPath);
		return entries.length > 0;
	} catch {
		return false;
	}
}

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Build the Obsidian MCP server entry, wrapping with cmd /c on Windows. */
function obsidianMcpEntry(brainPath: string): McpPrescription["entry"] {
	if (platform() === "win32") {
		return { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", brainPath] };
	}
	return { command: "npx", args: ["@bitbonsai/mcpvault", brainPath] };
}

/** The vault directories that init scaffolds into a fresh vault. */
const VAULT_DIRS = ["research", "process/retro", "coding-playbook"] as const;

/**
 * Return planning steps for brain vault scaffolding and Obsidian MCP wiring.
 *
 * The function signature requires a resolved `brainPath` — the caller (agent)
 * guarantees a path is provided before calling. Returns two `InitStep` items:
 *
 * 1. Vault scaffolding (category `"brain"`): `exists` if vault is already
 *    populated, `would-create` with the directories list as JSON content.
 * 2. Obsidian MCP entry (category `"mcp"`): `exists` if the obsidian key is
 *    already in the config, `would-create` with a `McpPrescription`.
 *    If the config file is malformed JSON, returns `would-create` with
 *    `configMalformed: true`.
 *
 * Neither step writes to disk — this helper is a planner only.
 */
export default async function provisionBrain(
	brainPath: string,
	mcpConfigPath: string,
): Promise<InitStep[]> {
	// Vault scaffolding step
	const vaultStep = await buildVaultStep(brainPath);

	// Obsidian MCP step
	const mcpStep = await buildObsidianMcpStep(brainPath, mcpConfigPath);

	return [vaultStep, mcpStep];
}

/** Build the vault scaffolding planning step. */
async function buildVaultStep(brainPath: string): Promise<InitStep> {
	if (await vaultExists(brainPath)) {
		return {
			name: "Brain vault",
			status: "exists",
			category: "brain",
			filePath: brainPath,
		};
	}

	return {
		name: "Brain vault",
		status: "would-create",
		category: "brain",
		filePath: brainPath,
		content: JSON.stringify(VAULT_DIRS),
	};
}

/** Build the Obsidian MCP wiring planning step. */
async function buildObsidianMcpStep(brainPath: string, mcpConfigPath: string): Promise<InitStep> {
	const prescription: McpPrescription = {
		key: "obsidian",
		entry: obsidianMcpEntry(brainPath),
	};

	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("obsidian" in servers) {
				return {
					name: "MCP config (obsidian)",
					status: "exists",
					category: "mcp",
					filePath: mcpConfigPath,
				};
			}
			return {
				name: "MCP config (obsidian)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		} catch {
			return {
				name: "MCP config (obsidian)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				configMalformed: true,
			};
		}
	}

	return {
		name: "MCP config (obsidian)",
		status: "would-create",
		category: "mcp",
		filePath: mcpConfigPath,
		prescription,
	};
}
