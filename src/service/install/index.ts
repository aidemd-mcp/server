import { z } from "zod";
import { join, isAbsolute, dirname } from "node:path";
import type { FrameworkType, InitResult, InitStep } from "@/types/index.js";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import { configureZed } from "@/service/install/configureIde/index.js";
import writeMethodology from "./writeMethodology/index.js";
import installMethodologyDocs from "./installMethodologyDocs/index.js";
import scaffoldCommands from "./scaffoldCommands/index.js";
import installAgents from "./installAgents/index.js";
import installSkills from "./installSkills/index.js";
import installAideTree from "./installAideTree/index.js";
import wireMcp from "./wireMcp/index.js";
import provisionBrain from "./provisionBrain/index.js";
import scaffoldReadme from "./scaffoldReadme/index.js";
import compareBytes from "./shared/compareBytes/index.js";

/**
 * Plan the brain-layer scaffolding for the given integration and return the two
 * InitStep records — brain.aide-scaffold step first, MCP-entry-plan step second.
 *
 * This is the entry point cli/init calls to obtain the brain.aide-scaffold step
 * it applies via `applySteps`. cli/init discards the MCP-entry-plan step; only
 * the brain.aide-scaffold step is applied at install time (sync owns the MCP
 * entry write after the user has filled the null slot).
 *
 * Today `integration` must be `"obsidian"` (the only registered template). The
 * parameter is accepted now so cli/init's call site is forward-compatible with
 * future integrations that land their own bundled templates.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 * @param _integration - Integration name selecting which bundled template scaffolds.
 *   Currently only `"obsidian"` is valid; the parameter is accepted for
 *   forward-compatibility and reserved for future integration routing.
 */
export async function planBrainCategory(projectRoot: string, _integration: string): Promise<InitStep[]> {
	const config = await detectFramework(projectRoot);
	const mcpConfigPath = join(projectRoot, config.mcpConfigPath);
	return provisionBrain(projectRoot, mcpConfigPath);
}

/**
 * Input schema for aide_init.
 *
 * `skipIde` was removed: IDE configuration is presented per-category during
 * the agent interview rather than suppressed via a flag.
 * `framework` remains so the agent can re-call after user confirms or
 * overrides framework detection. The retired `brainPath` argument is gone: the
 * brain category is always planned and the brain root is not this layer's concern.
 */
export const InitInput = z.object({
	framework: z.enum(["claude", "cursor", "windsurf", "copilot"]).optional().describe("Force a specific framework instead of auto-detecting"),
	path: z.string().optional().describe("Custom project root path (defaults to server working directory)"),
	category: z.enum(["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide", "readme"]).optional().describe("When provided, write all would-create files to disk and return a manifest. When omitted, return all steps as a metadata-only summary (no content fields)."),
});

/**
 * Bootstrap the AIDE development environment into a project.
 *
 * Returns structured JSON (`InitResult`) — no prose, no formatting. The
 * calling agent interprets the result, walks the user through each category,
 * and applies the steps the user confirms.
 *
 * Each step is idempotent: re-running on a fully initialized project returns
 * all steps as `exists`. Brain hints are discovered from env var, sibling
 * path, and conventional path — returned as interview material for the agent;
 * they never influence the brain plan.
 *
 * @param root - Server working directory (from --root CLI arg or cwd).
 * @param framework - Optional framework override.
 * @param path - Optional project root override (absolute or relative to root).
 */
export default async function init(
	root: string,
	framework?: FrameworkType,
	path?: string,
): Promise<InitResult> {
	const projectRoot = path ? (isAbsolute(path) ? path : join(root, path)) : root;
	const config = await detectFramework(projectRoot, framework);
	const brainHints = await resolveBrainHints(projectRoot);

	// Collect planning steps from each helper. Order follows the spec's category
	// list: methodology, commands, agents, skills, mcp, brain, ide.
	const docSteps = await installMethodologyDocs(join(projectRoot, config.docHubDir), config.docHubDir);
	const methodologyStep = await writeMethodology(join(projectRoot, config.configPath), config.docHubDir);
	const commandSteps = await scaffoldCommands(join(projectRoot, config.commandDir));
	const agentSteps = await installAgents(join(projectRoot, config.agentDir));
	const skillSteps = await installSkills(join(projectRoot, config.skillDir));
	const aideTreeSteps = await installAideTree(projectRoot);
	const mcpStep = await wireMcp(join(projectRoot, config.mcpConfigPath));

	// The brain category is always planned. The brain config step is presence-only
	// (an existing .aide/config/brain.aide is never overwritten), carries the published
	// brainContract, and carries a brainRepair prescription when the config is outdated.
	// The brain root is not this layer's concern: the config prose seeds the brain.
	// brainHints stay interview material for the agent and never feed the plan.
	const brainMcpPath = join(projectRoot, config.mcpConfigPath);
	const brainSteps = await provisionBrain(projectRoot, brainMcpPath);

	// ── versions.json ────────────────────────────────────────────────────────
	// Deliver the static versions manifest alongside the methodology docs so
	// both aide_init and aide_upgrade give the host the same artifact.
	const versionsHostPath = join(projectRoot, dirname(config.docHubDir), "versions.json");
	const versionsManifest = readVersionsManifest();
	const versionsJson = JSON.stringify(versionsManifest, null, 2) + "\n";
	const versionsBytesResult = await compareBytes(versionsHostPath, versionsJson);
	const versionsStep: InitStep = {
		name: "versions.json",
		status: versionsBytesResult === "would-skip" ? "exists" : versionsBytesResult,
		category: "methodology",
		filePath: versionsHostPath,
		...(versionsBytesResult !== "would-skip" ? { content: versionsJson } : {}),
	};

	const zedStep = await configureZed(projectRoot);
	const readmeStep = await scaffoldReadme(projectRoot);

	const steps = [
		methodologyStep,
		...docSteps,
		versionsStep,
		...commandSteps,
		...agentSteps,
		...skillSteps,
		...aideTreeSteps,
		mcpStep,
		...brainSteps,
		zedStep,
		readmeStep,
	];

	return {
		framework: config.framework,
		steps,
		brainHints,
	};
}
