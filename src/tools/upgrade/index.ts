import { z } from "zod";
import { join, dirname, isAbsolute } from "node:path";
import type {
	FrameworkType,
	UpgradeCategory,
	UpgradeCategoryResult,
	UpgradeFileResult,
	UpgradeResult,
} from "@/types/index.js";
import detectFramework from "@/tools/init/detectFramework/index.js";
import { readCanonicalDoc, listMethodologyDocs, listAgents, listSkills } from "@/tools/init/initContent/index.js";
import { COMMANDS } from "@/tools/init/scaffoldCommands/index.js";
import compareFile from "./compareFile/index.js";
import spliceStub from "./spliceStub/index.js";
import readVersionsManifest from "./buildVersionsMeta/index.js";
import checkMcpConfig from "./checkMcpConfig/index.js";
import { checkZedConfig, checkVscodeExtension } from "./checkIdeConfig/index.js";

export const UpgradeInput = z.object({
	framework: z
		.enum(["claude", "cursor", "windsurf", "copilot"])
		.optional()
		.describe("Force a specific framework instead of auto-detecting"),
	path: z
		.string()
		.optional()
		.describe("Custom project root path (defaults to server working directory)"),
	category: z
		.enum(["pointer-stub", "methodology-docs", "version-metadata", "commands", "agents", "skills", "mcp", "ide"])
		.optional()
		.describe("When provided, write all differs/missing files for this category to disk and return a manifest (no canonicalContent). When omitted, return all categories as metadata-only summaries (no canonicalContent fields)."),
});

/** Build an `UpgradeCategoryResult` from a flat list of file results. */
function buildCategoryResult(
	category: UpgradeCategory,
	files: UpgradeFileResult[],
): UpgradeCategoryResult {
	const summary = {
		total: files.length,
		differs: files.filter((f) => f.status === "differs").length,
		missing: files.filter((f) => f.status === "missing").length,
		matches: files.filter((f) => f.status === "matches").length,
	};
	return { category, files, summary };
}

/**
 * Compare every driftable AIDE methodology artifact against canonical and
 * return structured per-category results.
 *
 * The tool is read-only — it never writes files. The calling agent presents
 * per-category results to the user and applies only the categories the user
 * confirms.
 */
export default async function upgrade(
	root: string,
	framework?: FrameworkType,
	path?: string,
): Promise<UpgradeResult> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework);

	const docHubAbsolute = join(projectRoot, config.docHubDir);
	const commandDirAbsolute = join(projectRoot, config.commandDir);
	const agentDirAbsolute = join(projectRoot, config.agentDir);
	const skillDirAbsolute = join(projectRoot, config.skillDir);

	// ── a. Pointer stub ──────────────────────────────────────────────────────
	const stubResult = await spliceStub(
		join(projectRoot, config.configPath),
		config.docHubDir,
	);

	// ── b. Methodology docs ──────────────────────────────────────────────────
	const docResults: UpgradeFileResult[] = [];
	for (const entry of listMethodologyDocs()) {
		const hostPath = join(docHubAbsolute, entry.hostFilename);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical);
		docResults.push({
			name: `${config.docHubDir}/${entry.hostFilename}`,
			filePath: hostPath,
			status,
			category: "methodology-docs",
			...(status !== "matches" ? { canonicalContent: canonical } : {}),
		});
	}

	// ── c. Version metadata ──────────────────────────────────────────────────
	const versionsMap = readVersionsManifest();
	const versionsJson = JSON.stringify(versionsMap, null, 2) + "\n";
	const aideRoot = join(docHubAbsolute, "..");
	const versionsHostPath = join(aideRoot, "versions.json");
	const versionsStatus = await compareFile(versionsHostPath, versionsJson);
	const versionResults: UpgradeFileResult[] = [
		{
			name: `${dirname(config.docHubDir)}/versions.json`,
			filePath: versionsHostPath,
			status: versionsStatus,
			category: "version-metadata",
			...(versionsStatus !== "matches" ? { canonicalContent: versionsJson } : {}),
		},
	];

	// ── d. Commands ──────────────────────────────────────────────────────────
	const commandResults: UpgradeFileResult[] = [];
	for (const cmd of COMMANDS) {
		const hostPath = join(commandDirAbsolute, cmd.hostPath);
		const canonical = readCanonicalDoc(cmd.canonical);
		const status = await compareFile(hostPath, canonical);
		commandResults.push({
			name: cmd.displayName,
			filePath: hostPath,
			status,
			category: "commands",
			...(status !== "matches" ? { canonicalContent: canonical } : {}),
		});
	}

	// ── e. Agents ────────────────────────────────────────────────────────────
	const agentResults: UpgradeFileResult[] = [];
	for (const entry of listAgents()) {
		const hostPath = join(agentDirAbsolute, entry.hostFilename);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical);
		agentResults.push({
			name: `agents/${entry.hostFilename}`,
			filePath: hostPath,
			status,
			category: "agents",
			...(status !== "matches" ? { canonicalContent: canonical } : {}),
		});
	}

	// ── f. Skills ────────────────────────────────────────────────────────────
	const skillResults: UpgradeFileResult[] = [];
	for (const entry of listSkills()) {
		const hostPath = join(skillDirAbsolute, entry.hostPath);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(hostPath, canonical);
		skillResults.push({
			name: `skills/${entry.hostPath}`,
			filePath: hostPath,
			status,
			category: "skills",
			...(status !== "matches" ? { canonicalContent: canonical } : {}),
		});
	}

	// ── g. MCP config ────────────────────────────────────────────────────────
	const mcpResult = await checkMcpConfig(join(projectRoot, config.mcpConfigPath));

	// ── h. IDE config ────────────────────────────────────────────────────────
	const zedResult = await checkZedConfig(projectRoot);
	const vscodeResult = await checkVscodeExtension();

	// ── Assemble categories ──────────────────────────────────────────────────
	const categories: UpgradeCategoryResult[] = [
		buildCategoryResult("pointer-stub", [stubResult]),
		buildCategoryResult("methodology-docs", docResults),
		buildCategoryResult("version-metadata", versionResults),
		buildCategoryResult("commands", commandResults),
		buildCategoryResult("agents", agentResults),
		buildCategoryResult("skills", skillResults),
		buildCategoryResult("mcp", [mcpResult]),
		buildCategoryResult("ide", [zedResult, vscodeResult]),
	];

	return { framework: config.framework, categories };
}
