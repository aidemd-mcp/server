import { access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { FrameworkType, FrameworkConfig } from "@/types/index.js";

/**
 * Per-framework path resolution for aide_init. The `docHubDir` field is
 * uniform across frameworks on purpose: the host-side doc hub is a
 * framework-agnostic surface (the agent crawls it via relative links, not
 * via framework-specific command wiring), so there is no reason to
 * diverge. Keeping the value uniform also makes it trivial to change the
 * hub location across every framework in a single edit.
 */
const FRAMEWORK_CONFIGS: Record<FrameworkType, Omit<FrameworkConfig, "framework">> = {
	claude: { configPath: "CLAUDE.md", commandDir: ".claude/commands", mcpConfigPath: ".mcp.json", docHubDir: ".aide/docs", agentDir: ".claude/agents", skillDir: ".claude/skills" },
	cursor: { configPath: ".cursorrules", commandDir: ".cursor/commands", mcpConfigPath: ".cursor/mcp.json", docHubDir: ".aide/docs", agentDir: ".cursor/agents", skillDir: ".cursor/skills" },
	windsurf: { configPath: ".windsurfrules", commandDir: ".windsurf/commands", mcpConfigPath: ".windsurf/mcp.json", docHubDir: ".aide/docs", agentDir: ".windsurf/agents", skillDir: ".windsurf/skills" },
	copilot: { configPath: ".github/copilot-instructions.md", commandDir: ".github/commands", mcpConfigPath: ".mcp.json", docHubDir: ".aide/docs", agentDir: ".github/agents", skillDir: ".github/skills" },
};

const DETECTION_SIGNALS: { framework: FrameworkType; paths: string[] }[] = [
	{ framework: "claude", paths: [".claude", "CLAUDE.md"] },
	{ framework: "cursor", paths: [".cursor", ".cursorrules"] },
	{ framework: "windsurf", paths: [".windsurf", ".windsurfrules"] },
	{ framework: "copilot", paths: [".github/copilot-instructions.md"] },
];

/** Check if a path exists. */
async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve the Obsidian vault path through the priority chain:
 * 1. explicit brainPath parameter
 * 2. AIDE_BRAIN_PATH environment variable
 * 3. sibling my-brain/ directory next to projectRoot
 * 4. platform-conventional location: ~/my-brain
 * Detection only checks existence — it does not create anything.
 */
async function resolveBrainPath(projectRoot: string, brainPath?: string): Promise<string | undefined> {
	if (brainPath) return brainPath;

	const envPath = process.env.AIDE_BRAIN_PATH;
	if (envPath) return envPath;

	const siblingPath = join(dirname(projectRoot), "my-brain");
	if (await exists(siblingPath)) return siblingPath;

	const conventionalPath = join(homedir(), "my-brain");
	if (await exists(conventionalPath)) return conventionalPath;

	return undefined;
}

/**
 * Detect the agent framework in use, or return config for a specified framework.
 * Checks for framework-specific marker files/directories. Defaults to Claude Code
 * if nothing is detected. Resolves the brain vault path via a priority chain.
 */
export default async function detectFramework(
	root: string,
	framework?: FrameworkType,
	brainPath?: string,
): Promise<FrameworkConfig> {
	const resolvedBrainPath = await resolveBrainPath(root, brainPath);

	if (framework) return { framework, ...FRAMEWORK_CONFIGS[framework], brainPath: resolvedBrainPath };

	for (const signal of DETECTION_SIGNALS) {
		for (const path of signal.paths) {
			if (await exists(join(root, path))) {
				return { framework: signal.framework, ...FRAMEWORK_CONFIGS[signal.framework], brainPath: resolvedBrainPath };
			}
		}
	}

	return { framework: "claude", ...FRAMEWORK_CONFIGS.claude, brainPath: resolvedBrainPath };
}
