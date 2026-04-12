import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { platform } from "node:os";
import type { InitStepResult } from "@/types/index.js";

/**
 * Read and parse a JSON config file. Returns null if the file does not exist
 * or cannot be parsed — callers treat null as "no usable config".
 */
async function safeReadJson(path: string): Promise<Record<string, unknown> | null> {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content) as Record<string, unknown>;
	} catch {
		return null;
	}
}

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

/**
 * Check whether a user-level MCP config already has an `obsidian` entry.
 * Returns true if the file exists, parses, and contains `mcpServers.obsidian`.
 * Parse failures are silently ignored (returns false).
 */
async function obsidianInUserConfig(userMcpConfigPath: string): Promise<boolean> {
	const config = await safeReadJson(userMcpConfigPath);
	if (!config) return false;
	const servers = config.mcpServers;
	if (typeof servers !== "object" || servers === null) return false;
	return "obsidian" in (servers as Record<string, unknown>);
}

/** Build the Obsidian MCP server entry, wrapping with cmd /c on Windows. */
function obsidianMcpEntry(brainPath: string): { command: string; args: string[] } {
	if (platform() === "win32") {
		return { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", brainPath] };
	}
	return { command: "npx", args: ["@bitbonsai/mcpvault", brainPath] };
}

/**
 * Provision the brain layer: scaffold a minimal Obsidian vault when none exists
 * and wire the Obsidian MCP server into the project's MCP config.
 *
 * Returns two results: one for the vault scaffolding, one for MCP wiring.
 * Both are skipped when brainPath is undefined. Both are independently reportable.
 *
 * @param userMcpConfigPath - Optional path to the user-level MCP config (e.g.
 *   `~/.claude.json` for Claude Code). When provided, the obsidian entry is
 *   checked there first — if already present globally, MCP wiring returns
 *   `exists` without touching the project-level config.
 */
export default async function provisionBrain(
	brainPath: string | undefined,
	mcpConfigPath: string,
	userMcpConfigPath?: string,
): Promise<InitStepResult[]> {
	if (brainPath === undefined) {
		return [
			{ name: "Brain vault", status: "skipped" },
			{ name: "MCP config (obsidian)", status: "skipped" },
		];
	}

	// Vault scaffolding
	const vaultResult = await provisionVault(brainPath);

	// MCP wiring
	const mcpResult = await wireObsidianMcp(brainPath, mcpConfigPath, userMcpConfigPath);

	return [vaultResult, mcpResult];
}

/** Scaffold the vault directory structure if no vault exists yet. */
async function provisionVault(brainPath: string): Promise<InitStepResult> {
	if (await vaultExists(brainPath)) {
		return { name: "Brain vault", status: "exists" };
	}

	const dirs = [
		brainPath,
		join(brainPath, "research"),
		join(brainPath, "process", "retro"),
		join(brainPath, "coding-playbook"),
	];

	for (const dir of dirs) {
		await mkdir(dir, { recursive: true });
	}

	return { name: "Brain vault", status: "created" };
}

/** Wire the Obsidian MCP entry into the project's MCP config. */
async function wireObsidianMcp(brainPath: string, mcpConfigPath: string, userMcpConfigPath?: string): Promise<InitStepResult> {
	// If obsidian is already registered in the user-level config, skip the
	// project-level write — no duplicate entry needed.
	if (userMcpConfigPath && await obsidianInUserConfig(userMcpConfigPath)) {
		return { name: "MCP config (obsidian)", status: "exists" };
	}
	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("obsidian" in servers) {
				return { name: "MCP config (obsidian)", status: "exists" };
			}
			servers.obsidian = obsidianMcpEntry(brainPath);
			config.mcpServers = servers;
			await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
			return { name: "MCP config (obsidian)", status: "wired" };
		} catch {
			return { name: "MCP config (obsidian)", status: "skipped" };
		}
	}

	// Config file doesn't exist yet — create a minimal one
	const config = { mcpServers: { obsidian: obsidianMcpEntry(brainPath) } };
	await mkdir(dirname(mcpConfigPath), { recursive: true });
	await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
	return { name: "MCP config (obsidian)", status: "wired" };
}
