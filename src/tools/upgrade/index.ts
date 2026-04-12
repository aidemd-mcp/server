import { z } from "zod";
import { join, isAbsolute, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FrameworkType, UpgradeStepResult } from "@/types/index.js";
import detectFramework from "@/tools/init/detectFramework/index.js";
import { readCanonicalDoc, listMethodologyDocs, listAgents, listSkills } from "@/tools/init/initContent/index.js";
import { COMMANDS } from "@/tools/init/scaffoldCommands/index.js";
import compareFile from "./compareFile/index.js";
import spliceStub from "./spliceStub/index.js";
import buildVersionsMeta from "./buildVersionsMeta/index.js";

const execFileAsync = promisify(execFile);

export const UpgradeInput = z.object({
	confirm: z.boolean().optional().default(false),
	framework: z.enum(["claude", "cursor", "windsurf", "copilot"]).optional().describe("Force a specific framework instead of auto-detecting"),
	path: z.string().optional().describe("Custom project root path (defaults to server working directory)"),
	skipIde: z.boolean().optional().describe("Skip IDE file association configuration (Zed settings, VS Code extension)"),
});

/** Canonical MCP server entry that upgrade checks and repairs. */
const CANONICAL_AIDE_SERVER = { command: "npx", args: ["aidemd-mcp"] } as const;

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
 * canonical shape. Unlike methodology docs and commands, the whole file cannot
 * be compared byte-for-byte because it may contain other servers that must
 * not be disturbed. Only the aide server entry is inspected and optionally
 * repaired; everything else is preserved verbatim.
 */
async function checkMcpConfig(
	mcpConfigPath: string,
	write: boolean,
): Promise<UpgradeStepResult> {
	const name = "MCP config";
	const existing = await safeReadFile(mcpConfigPath);

	if (existing === undefined) {
		if (write) {
			const config = { mcpServers: { aide: CANONICAL_AIDE_SERVER } };
			await mkdir(dirname(mcpConfigPath), { recursive: true });
			await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
			return { name, status: "created" };
		}
		return { name, status: "would create" };
	}

	let config: Record<string, unknown>;
	try {
		config = JSON.parse(existing);
	} catch {
		// Unparseable config — treat as missing aide entry.
		if (write) {
			const fresh = { mcpServers: { aide: CANONICAL_AIDE_SERVER } };
			await writeFile(mcpConfigPath, JSON.stringify(fresh, null, 2) + "\n", "utf-8");
			return { name, status: "updated" };
		}
		return { name, status: "would update" };
	}

	const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

	// Check both key names init may have used.
	const aideEntry = ("aide" in servers ? servers["aide"] : servers["aidemd-mcp"]) as
		| { command?: unknown; args?: unknown }
		| undefined;

	const isCanonical =
		aideEntry !== undefined &&
		aideEntry.command === CANONICAL_AIDE_SERVER.command &&
		Array.isArray(aideEntry.args) &&
		aideEntry.args.length === CANONICAL_AIDE_SERVER.args.length &&
		CANONICAL_AIDE_SERVER.args.every((a, i) => (aideEntry.args as unknown[])[i] === a);

	if (isCanonical) {
		return { name, status: "unchanged" };
	}

	if (write) {
		// Normalise: always write under "aide" key, remove legacy "aidemd-mcp" key.
		if ("aidemd-mcp" in servers) delete servers["aidemd-mcp"];
		servers["aide"] = CANONICAL_AIDE_SERVER;
		config.mcpServers = servers;
		await writeFile(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
		return { name, status: "updated" };
	}

	return { name, status: "would update" };
}

/**
 * Check or apply Zed file-type association for .aide files.
 * Dry-run: reads .zed/settings.json and reports status without writing.
 * Confirm: merges the association into the settings file.
 */
async function checkZedConfig(
	projectRoot: string,
	write: boolean,
): Promise<UpgradeStepResult> {
	const name = "Zed config";
	const settingsPath = join(projectRoot, ".zed", "settings.json");
	const existing = await safeReadFile(settingsPath);

	if (existing !== undefined) {
		try {
			const settings = JSON.parse(existing);
			const mdTypes: string[] = settings.file_types?.Markdown ?? [];

			if (mdTypes.includes("*.aide")) {
				return { name, status: "unchanged" };
			}

			if (write) {
				mdTypes.push("*.aide");
				settings.file_types = { ...(settings.file_types ?? {}), Markdown: mdTypes };
				await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
				return { name, status: "updated" };
			}

			return { name, status: "would update" };
		} catch {
			// Unparseable settings — skip silently.
			return { name, status: "unchanged" };
		}
	}

	// Settings file absent: association is missing.
	if (write) {
		await mkdir(join(projectRoot, ".zed"), { recursive: true });
		const settings = { file_types: { Markdown: ["*.aide"] } };
		await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
		return { name, status: "created" };
	}

	return { name, status: "would create" };
}

/**
 * Check or apply VS Code .aide extension installation.
 * Dry-run: checks extension list without installing.
 * Confirm: installs the extension if not already present.
 */
async function checkVscodeExtension(
	write: boolean,
): Promise<UpgradeStepResult> {
	const name = "VS Code extension";

	// Ensure `code` CLI is available.
	try {
		await execFileAsync("code", ["--version"]);
	} catch {
		return { name, status: "unchanged" };
	}

	// Check installation state.
	let installed: boolean;
	try {
		const { stdout } = await execFileAsync("code", ["--list-extensions"]);
		installed = stdout.toLowerCase().includes("aide-markdown");
	} catch {
		return { name, status: "unchanged" };
	}

	if (installed) {
		return { name, status: "unchanged" };
	}

	if (!write) {
		return { name, status: "would update" };
	}

	// Locate the .vsix relative to this package.
	const { fileURLToPath } = await import("node:url");
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const vsixPath = join(moduleDir, "..", "..", "..", "extensions", "vscode", "aide-markdown-0.0.1.vsix");

	try {
		await readFile(vsixPath);
		await execFileAsync("code", ["--install-extension", vsixPath]);
		return { name, status: "updated" };
	} catch {
		return { name, status: "unchanged" };
	}
}

/** Symbol that prefixes each result line in the output. */
function symbol(status: UpgradeStepResult["status"]): string {
	switch (status) {
		case "would update":
		case "updated":
			return "~";
		case "unchanged":
			return "=";
		case "would create":
		case "created":
			return "+";
	}
}

/** True when a result represents a file that will/did change. */
function isChanged(status: UpgradeStepResult["status"]): boolean {
	return status !== "unchanged";
}

/**
 * Bring a host project up to date with the current canonical AIDE artifacts.
 *
 * Without `confirm`, performs a dry-run: every driftable file is compared
 * against canonical and a prospective status is reported. No disk writes occur.
 *
 * With `confirm: true`, every methodology artifact is overwritten with the
 * current canonical version in a single all-or-nothing pass.
 */
export default async function upgrade(
	root: string,
	confirm: boolean,
	framework?: FrameworkType,
	path?: string,
	skipIde?: boolean,
): Promise<string> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework);

	const docHubAbsolute = join(projectRoot, config.docHubDir);
	const commandDirAbsolute = join(projectRoot, config.commandDir);
	const agentDirAbsolute = join(projectRoot, config.agentDir);
	const skillDirAbsolute = join(projectRoot, config.skillDir);

	const results: UpgradeStepResult[] = [];

	// ── a. Pointer stub ─────────────────────────────────────────────────────
	// Runs before docs so the ordering mirrors init: stub first, then hub.
	const stubResult = await spliceStub(
		join(projectRoot, config.configPath),
		config.docHubDir,
		confirm,
	);
	results.push(stubResult);

	// ── b. Methodology docs ─────────────────────────────────────────────────
	for (const entry of listMethodologyDocs()) {
		const hostPath = join(docHubAbsolute, entry.hostFilename);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical, confirm);
		results.push({ name: `${config.docHubDir}/${entry.hostFilename}`, status });
	}

	// ── b2. Version metadata ────────────────────────────────────────────────
	const versionsMap = await buildVersionsMeta();
	const versionsJson = JSON.stringify(versionsMap, null, 2) + "\n";
	const versionsHostPath = join(docHubAbsolute, "versions.json");
	const versionsStatus = await compareFile(versionsHostPath, versionsJson, confirm);
	results.push({ name: `${config.docHubDir}/versions.json`, status: versionsStatus });

	// ── c. Commands ─────────────────────────────────────────────────────────
	for (const cmd of COMMANDS) {
		const hostPath = join(commandDirAbsolute, cmd.hostPath);
		const canonical = readCanonicalDoc(cmd.canonical);
		const status = await compareFile(hostPath, canonical, confirm);
		results.push({ name: cmd.displayName, status });
	}

	// ── d. Agents ──────────────────────────────────────────────────────────
	for (const entry of listAgents()) {
		const hostPath = join(agentDirAbsolute, entry.hostFilename);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical, confirm);
		results.push({ name: `agents/${entry.hostFilename}`, status });
	}

	// ── e. Skills ──────────────────────────────────────────────────────────
	for (const entry of listSkills()) {
		const hostPath = join(skillDirAbsolute, entry.hostPath);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical, confirm);
		results.push({ name: `skills/${entry.hostPath}`, status });
	}

	// ── f. MCP config (inline — must not disturb other servers) ─────────────
	results.push(await checkMcpConfig(join(projectRoot, config.mcpConfigPath), confirm));

	// ── e. IDE config ────────────────────────────────────────────────────────
	if (!skipIde) {
		results.push(await checkZedConfig(projectRoot, confirm));
		results.push(await checkVscodeExtension(confirm));
	}

	// ── Format output ────────────────────────────────────────────────────────
	const header = confirm
		? `AIDE upgraded (${config.framework} framework):`
		: `AIDE upgrade preview (${config.framework} framework):`;

	const allUnchanged = results.every((r) => !isChanged(r.status));

	if (!confirm && allUnchanged) {
		return `${header}\n\n  All ${results.length} methodology artifacts match canonical. Nothing to upgrade.`;
	}

	const lines = results.map((r) => `  ${symbol(r.status)} ${r.name}: ${r.status}`);

	if (confirm) {
		const updated = results.filter((r) => r.status === "updated").length;
		const created = results.filter((r) => r.status === "created").length;
		const unchanged = results.filter((r) => r.status === "unchanged").length;
		const summary = `${created} file${created !== 1 ? "s" : ""} created, ${updated} file${updated !== 1 ? "s" : ""} updated, ${unchanged} file${unchanged !== 1 ? "s" : ""} unchanged.`;
		return `${header}\n\n${lines.join("\n")}\n\n  ${summary}`;
	}

	// Dry-run with at least one changed file: compose the warning.
	const affectedCategories: string[] = [];

	const stubChanged = isChanged(stubResult.status);
	if (stubChanged) affectedCategories.push("pointer stub");

	const docNames = new Set(listMethodologyDocs().map((e) => `${config.docHubDir}/${e.hostFilename}`));
	docNames.add(`${config.docHubDir}/versions.json`);
	const docsChanged = results.some((r) => docNames.has(r.name) && isChanged(r.status));
	if (docsChanged) affectedCategories.push("methodology docs");

	const cmdNames = new Set(COMMANDS.map((c) => c.displayName));
	const cmdsChanged = results.some((r) => cmdNames.has(r.name) && isChanged(r.status));
	if (cmdsChanged) affectedCategories.push("slash commands");

	const agentNames = new Set(listAgents().map((e) => `agents/${e.hostFilename}`));
	const agentsChanged = results.some((r) => agentNames.has(r.name) && isChanged(r.status));
	if (agentsChanged) affectedCategories.push("agents");

	const skillNames = new Set(listSkills().map((e) => `skills/${e.hostPath}`));
	const skillsChanged = results.some((r) => skillNames.has(r.name) && isChanged(r.status));
	if (skillsChanged) affectedCategories.push("skills");

	const mcpChanged = results.some((r) => r.name === "MCP config" && isChanged(r.status));
	if (mcpChanged) affectedCategories.push("MCP config");

	const ideNames = new Set(["Zed config", "VS Code extension"]);
	const ideChanged = results.some((r) => ideNames.has(r.name) && isChanged(r.status));
	if (ideChanged) affectedCategories.push("IDE config");

	const warning =
		`  Warning: confirming will overwrite local customizations in:\n` +
		`  ${affectedCategories.join(", ")}.\n\n` +
		`  To proceed, call aide_upgrade with confirm: true.`;

	return `${header}\n\n${lines.join("\n")}\n\n${warning}`;
}
