import { access } from "node:fs/promises";
import { join } from "node:path";
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
	claude: { configPath: "CLAUDE.md", commandDir: ".claude/commands", mcpConfigPath: ".mcp.json", docHubDir: ".aide/docs" },
	cursor: { configPath: ".cursorrules", commandDir: ".cursor/commands", mcpConfigPath: ".cursor/mcp.json", docHubDir: ".aide/docs" },
	windsurf: { configPath: ".windsurfrules", commandDir: ".windsurf/commands", mcpConfigPath: ".windsurf/mcp.json", docHubDir: ".aide/docs" },
	copilot: { configPath: ".github/copilot-instructions.md", commandDir: ".github/commands", mcpConfigPath: ".mcp.json", docHubDir: ".aide/docs" },
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
 * Detect the agent framework in use, or return config for a specified framework.
 * Checks for framework-specific marker files/directories. Defaults to Claude Code
 * if nothing is detected.
 */
export default async function detectFramework(
	root: string,
	framework?: FrameworkType,
): Promise<FrameworkConfig> {
	if (framework) return { framework, ...FRAMEWORK_CONFIGS[framework] };

	for (const signal of DETECTION_SIGNALS) {
		for (const path of signal.paths) {
			if (await exists(join(root, path))) {
				return { framework: signal.framework, ...FRAMEWORK_CONFIGS[signal.framework] };
			}
		}
	}

	return { framework: "claude", ...FRAMEWORK_CONFIGS.claude };
}
