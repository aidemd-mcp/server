/** The four .aide spec types: intent, research, plan, todo. */
export type AideFileType = "intent" | "research" | "todo" | "plan";

/** Parsed YAML frontmatter from an .aide file. */
export interface AideFrontmatter {
	/** Module scope label (e.g. ".", "cli", "tools/discover"). */
	scope?: string;
	/** Human-readable intent statement for this module. */
	intent?: string;
	/** Desired and undesired outcome lists. */
	outcomes?: {
		desired: string[];
		undesired: string[];
	};
}

/** A parsed body section split on `##` headings. */
export interface BodySection {
	/** The heading text without the `## ` prefix. */
	heading: string;
	/** Full section content (everything between this heading and the next). */
	content: string;
	/** First sentence or paragraph-count summary. */
	summary: string;
}

/** A discovered .aide file with metadata. */
export interface AideFile {
	/** Absolute path to the file. */
	path: string;
	/** Path relative to the project root, POSIX-normalized. */
	relativePath: string;
	/** Classified type based on filename. */
	type: AideFileType;
	/** First ~80 chars of the first paragraph, for tree summaries. */
	summary: string;
}

/** Result of scanning a directory tree for .aide files. */
export interface ScanResult {
	/** Project root that was scanned. */
	root: string;
	/** All discovered .aide files. */
	files: AideFile[];
}

/** A validation warning found by aide_validate. */
export interface ValidationWarning {
	/** Category of the warning. */
	kind:
		| "orphaned-spec"
		| "missing-spec"
		| "naming-conflict"
		| "broken-link"
		| "orphaned-research";
	/** Path relative to project root where the issue was found. */
	path: string;
	/** Human-readable description of the issue. */
	message: string;
}

/** Result of validating a project's .aide files. */
export interface ValidationResult {
	/** Project root that was validated. */
	root: string;
	/** All warnings found. */
	warnings: ValidationWarning[];
}

/** Context returned alongside a read .aide file. */
export interface ReadResult {
	/** Full file content. */
	content: string;
	/** Classified type. */
	type: AideFileType;
	/** Related specs in the same directory. */
	siblings: AideFile[];
	/** Links found in the content (relative paths, wikilinks, URLs). */
	links: string[];
}

/** Supported agent frameworks for aide_init. */
export type FrameworkType = "claude" | "cursor" | "windsurf" | "copilot";

/** Resolved paths for a detected agent framework. */
export interface FrameworkConfig {
	/** Which framework was detected (or overridden). */
	framework: FrameworkType;
	/** Path to the agent config file relative to project root (e.g., "CLAUDE.md"). */
	configPath: string;
	/** Directory for slash command files relative to project root. */
	commandDir: string;
	/** Path to MCP config file relative to project root. */
	mcpConfigPath: string;
	/**
	 * Directory for the host-side AIDE methodology doc hub, relative to the
	 * project root. The sibling helpers `writeMethodology` and
	 * `installMethodologyDocs` both derive the host-side hub location from
	 * this single field — the stub names the path, the installer writes into
	 * it, and any disagreement between the two sides would send agents to an
	 * empty directory. Editing this value is the one-place change for the
	 * host-side hub location across the init subtree.
	 */
	docHubDir: string;
	/** Directory for agent files relative to project root. */
	agentDir: string;
	/** Directory for skill files relative to project root. */
	skillDir: string;
}

/**
 * A single MCP server prescription returned by init and upgrade.
 * Represents the key name and server entry the MCP config needs.
 * The calling agent reads the existing config, merges this entry, and writes.
 */
export interface McpPrescription {
	/** The mcpServers key name (e.g. "aide", "obsidian"). */
	key: string;
	/** The server entry to merge into mcpServers. */
	entry: { command: string; args: string[] };
}

/**
 * The category of a single init step. The calling agent uses this
 * discriminant to walk through categories with the user.
 */
export type InitCategory =
	| "framework"
	| "methodology"
	| "commands"
	| "agents"
	| "skills"
	| "mcp"
	| "brain"
	| "ide";

/**
 * Status of a single init step. The tool is a planner only — it never writes.
 * These statuses reflect planning outcomes, not execution outcomes.
 */
export type InitStepStatus = "would-create" | "would-skip" | "exists";

/**
 * A single step in the init plan returned by aide_init.
 * For `would-create` steps, `content` carries the bytes to write (for file steps)
 * or `prescription` carries the MCP entry (for MCP steps).
 */
export interface InitStep {
	/** Human-readable name for this step. */
	name: string;
	/** Planning status — what the agent should do with this step. */
	status: InitStepStatus;
	/** Category for grouping during agent-user conversation. */
	category: InitCategory;
	/** Absolute target path on disk where this step writes. */
	filePath: string;
	/** File content to write — present for `would-create` file steps, absent for `exists`. */
	content?: string;
	/** MCP prescription — present for `would-create` MCP steps, absent for `exists`. */
	prescription?: McpPrescription;
	/** True when the MCP config file exists but cannot be parsed as JSON. */
	configMalformed?: boolean;
}

/**
 * A discovered brain vault candidate returned by resolveBrainHints.
 * The agent presents these as suggestions and asks the user to confirm
 * or provide a different path.
 */
export interface BrainHint {
	/** How this path was discovered. */
	source: "env" | "sibling" | "conventional";
	/** Absolute path to the candidate vault location. */
	path: string;
}

/**
 * The structured JSON result returned by aide_init.
 * No prose, no formatting — the agent interprets this and drives the conversation.
 */
export interface InitResult {
	/** The detected (or overridden) framework. */
	framework: FrameworkType;
	/** All init steps the agent should present and apply. */
	steps: InitStep[];
	/** Discovered vault location candidates for the brain interview. */
	brainHints: BrainHint[];
}

/**
 * Per-category group names for upgrade results.
 * The agent presents results grouped by category and lets the user confirm
 * or decline each category independently.
 */
export type UpgradeCategory =
	| "pointer-stub"
	| "methodology-docs"
	| "version-metadata"
	| "commands"
	| "agents"
	| "skills"
	| "mcp"
	| "ide";

/**
 * Comparison status for a single file in an upgrade run.
 * The tool is read-only — these statuses reflect comparison results, not
 * write outcomes. `"malformed"` is used only for MCP config that cannot
 * be parsed as JSON.
 */
export type UpgradeFileStatus = "matches" | "differs" | "missing" | "malformed";

/**
 * Result of comparing a single file against its canonical version.
 * For `differs` and `missing` statuses, `canonicalContent` carries the bytes
 * the agent should write. For `mcp` category files, `prescription` carries
 * the server entry to merge.
 */
export interface UpgradeFileResult {
	/** Human-readable label for this file (e.g. filename or display name). */
	name: string;
	/** Absolute path on disk where this file lives (or would be written). */
	filePath: string;
	/** Comparison outcome. */
	status: UpgradeFileStatus;
	/** Category this file belongs to — used for grouping. */
	category: UpgradeCategory;
	/**
	 * Full canonical content to write — present for `differs` and `missing`,
	 * absent for `matches` and `malformed`.
	 */
	canonicalContent?: string;
	/**
	 * MCP prescription — present for `mcp` category `differs` and `missing`
	 * results. The agent merges this entry into the existing config.
	 */
	prescription?: McpPrescription;
}

/**
 * Per-category grouping of upgrade file results with a computed summary.
 * The agent uses the summary to skip all-matching categories and only present
 * drifted ones to the user.
 */
export interface UpgradeCategoryResult {
	/** The category these results belong to. */
	category: UpgradeCategory;
	/** All file results in this category. */
	files: UpgradeFileResult[];
	/** Counts for quick agent decision-making. */
	summary: {
		total: number;
		differs: number;
		missing: number;
		matches: number;
	};
}

/**
 * Structured JSON result returned by aide_upgrade.
 * No prose, no formatting — the agent interprets this and drives the
 * per-category confirmation flow.
 */
export interface UpgradeResult {
	/** The detected (or overridden) framework. */
	framework: FrameworkType;
	/** All category results, in canonical order. */
	categories: UpgradeCategoryResult[];
}

/** A node in the hierarchical TUI tree. */
export type TreeNode =
	| { kind: "dir"; path: string; children: TreeNode[] }
	| { kind: "file"; file: AideFile };

/** Directories to skip during filesystem walks. */
export const SKIP_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"coverage",
	"__pycache__",
] as const;
