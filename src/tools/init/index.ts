import { z } from "zod";
import { join, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrameworkType, InitResult } from "@/types/index.js";
import detectFramework from "@/tools/init/detectFramework/index.js";
import resolveBrainHints from "@/tools/init/resolveBrainHints/index.js";
import { configureZed, configureVscode } from "@/tools/init/configureIde/index.js";
import writeMethodology from "./writeMethodology/index.js";
import installMethodologyDocs from "./installMethodologyDocs/index.js";
import scaffoldCommands from "./scaffoldCommands/index.js";
import installAgents from "./installAgents/index.js";
import installSkills from "./installSkills/index.js";
import installAideTree from "./installAideTree/index.js";
import wireMcp from "./wireMcp/index.js";
import provisionBrain from "./provisionBrain/index.js";

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
	category: z.enum(["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide"]).optional().describe("When provided, write all would-create files to disk and return a manifest. When omitted, return all steps as a metadata-only summary (no content fields)."),
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
	// provided (agent-confirmed), use it directly. When hints exist, use the
	// first hint to check existing state. When neither is available, return
	// placeholder steps so the agent knows to interview the user first.
	const brainMcpPath = join(projectRoot, config.mcpConfigPath);
	let brainSteps: import("@/types/index.js").InitStep[];
	const resolvedBrainPath = brainPath ?? (brainHints.length > 0 ? brainHints[0].path : undefined);
	if (resolvedBrainPath) {
		brainSteps = await provisionBrain(resolvedBrainPath, brainMcpPath);
	} else {
		// No hints discovered and no explicit brainPath — the agent must ask the
		// user for a path. Return would-create steps with empty filePaths so the
		// agent knows brain provisioning is pending user input, not silently resolved.
		brainSteps = [
			{ name: "Brain vault", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "Playbook hub", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "Vault CLAUDE.md", status: "would-create" as const, category: "brain" as const, filePath: "" },
			{ name: "MCP config (obsidian)", status: "would-create" as const, category: "mcp" as const, filePath: brainMcpPath },
		];
	}

	const extensionsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "extensions", "vscode");
	const zedStep = await configureZed(projectRoot);
	const vscodeStep = await configureVscode(extensionsDir);

	const steps = [
		methodologyStep,
		...docSteps,
		...commandSteps,
		...agentSteps,
		...skillSteps,
		...aideTreeSteps,
		mcpStep,
		...brainSteps,
		zedStep,
		vscodeStep,
	];

	return {
		framework: config.framework,
		steps,
		brainHints,
	};
}
