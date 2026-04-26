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
 * Input schema for aide_init.
 *
 * `brainPath` and `skipIde` are removed: the brain path is always resolved
 * through agent-user conversation (not a silent tool parameter), and IDE
 * configuration is presented per-category during the agent interview.
 * `framework` remains so the agent can re-call after user confirms or
 * overrides framework detection.
 */
export const InitInput = z.object({
	framework: z.enum(["claude", "cursor", "windsurf", "copilot"]).optional().describe("Force a specific framework instead of auto-detecting"),
	path: z.string().optional().describe("Custom project root path (defaults to server working directory)"),
	category: z.enum(["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide", "readme"]).optional().describe("When provided, write all would-create files to disk and return a manifest. When omitted, return all steps as a metadata-only summary (no content fields)."),
	brainPath: z.string().optional().describe("Resolved brain vault path for the brain category. The agent provides this after interviewing the user."),
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
 * path, and conventional path — returned as candidates the agent presents
 * to the user; the agent confirms the path before any vault work is done.
 *
 * @param root - Server working directory (from --root CLI arg or cwd).
 * @param framework - Optional framework override.
 * @param path - Optional project root override (absolute or relative to root).
 * @param brainPath - User-confirmed vault path. When provided, forwarded to
 *   provisionBrain instead of using the first discovered hint.
 */
export default async function init(
	root: string,
	framework?: FrameworkType,
	path?: string,
	brainPath?: string,
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

	// Brain steps require a confirmed vault path. When brainPath is explicitly
	// provided (agent-confirmed), delegate fully to provisionBrain. When absent,
	// return placeholder steps with empty filePaths so the agent knows to interview
	// the user first — the brain MCP entry prescription is written with an empty
	// vault path (obsidianMcpEntry("")) so the orchestrator's inline-recovery flow
	// detects the invalid-path state and prompts the user to supply the real path.
	// brainHints are interview material for the agent; they are NEVER used as a
	// planner-side default to avoid silently baking a hint into the prescription
	// before the user has confirmed the path.
	const brainMcpPath = join(projectRoot, config.mcpConfigPath);
	let brainSteps: InitStep[];
	if (brainPath !== undefined) {
		// Delegate to provisionBrain with all three inputs: the host project root
		// (where .aide/brain.aide lives), the vault location, and the MCP config path.
		brainSteps = await provisionBrain(projectRoot, brainPath, brainMcpPath);
	} else {
		// No explicit brainPath — the agent must ask the user. Return placeholder
		// steps with empty filePaths. The MCP step prescription is omitted: without
		// brain.aide there is no source of truth to derive an entry from. The
		// orchestrator's /aide:brain config flow scaffolds brain.aide first.
		brainSteps = [
			{ name: "Brain config (brain.aide)", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "Brain root directories", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "Playbook hub", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "Research hub", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{
				name: "MCP config (brain)",
				status: "would-create" as const,
				category: "mcp" as const,
				filePath: brainMcpPath,
			},
		];
	}

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
