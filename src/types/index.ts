/** The four .aide spec types: intent, research, plan, todo. */
export type AideFileType = "intent" | "research" | "todo" | "plan";

/** Parsed YAML frontmatter from an .aide file. */
export interface AideFrontmatter {
	/** Module scope label (e.g. ".", "cli", "tools/discover"). */
	scope?: string;
	/** One-line purpose statement. Makes ancestor chains in aide_discover self-contained. */
	description?: string;
	/** Human-readable intent statement for this module. */
	intent?: string;
	/** Desired and undesired outcome lists. */
	outcomes?: {
		desired: string[];
		undesired: string[];
	};
	/**
	 * Alignment state. Omit for pending (the implicit default — no review yet).
	 * Set to "aligned" by the aligner agent; set to "misaligned" by QA on drift.
	 * "pending" is never stored or surfaced — its absence is the signal.
	 */
	status?: "aligned" | "misaligned";
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
	/** Frontmatter description field — one-line human-readable summary. Empty string when absent. */
	description?: string;
	/** Alignment status from frontmatter — present only when explicitly set. */
	status?: "aligned" | "misaligned";
	/** YAML parse error message — present only when frontmatter failed to parse. */
	parseError?: string;
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
		| "orphaned-research"
		| "missing-description"
		| "parse-error";
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
	| "ide"
	| "readme";

/**
 * Status of a single init step.
 * `"would-create"`, `"would-skip"`, and `"exists"` are planning outcomes.
 * `"created"` is an execution outcome returned by applySteps after the tool
 * has written a file to disk during a category call.
 */
export type InitStepStatus = "would-create" | "would-skip" | "exists" | "created";

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
	/**
	 * CLI command the agent should execute for steps that require external
	 * tooling (e.g. `code --install-extension <vsixPath>` for VS Code).
	 * Present only on `would-create` IDE VS Code steps that pass through
	 * applySteps without being written to disk.
	 */
	instructions?: string;
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
	| "ide"
	| "readme";

/**
 * Comparison status for a single file in an upgrade run.
 * `"matches"`, `"differs"`, `"missing"`, and `"malformed"` are comparison
 * outcomes returned by the dry-run phase. `"updated"`, `"created"`, and
 * `"unchanged"` are execution outcomes returned by applyFiles after the tool
 * has written (or confirmed) files during a category call — parallel to
 * init's `"created"` status. `"unchanged"` means the file already matched
 * canonical and no write was needed. `"malformed"` is used only for MCP
 * config that cannot be parsed as JSON.
 */
export type UpgradeFileStatus = "matches" | "differs" | "missing" | "malformed" | "updated" | "created" | "unchanged";

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
	 * absent for `matches` and `malformed`. Stripped from the response after
	 * applyFiles writes the content to disk.
	 */
	canonicalContent?: string;
	/**
	 * MCP prescription — present for `mcp` category `differs` and `missing`
	 * results. The agent merges this entry into the existing config.
	 */
	prescription?: McpPrescription;
	/**
	 * CLI command the agent should execute for steps that require external
	 * tooling (e.g. `code --install-extension <vsixPath>` for VS Code).
	 * Present only on IDE VS Code steps that pass through applyFiles without
	 * being written to disk.
	 */
	instructions?: string;
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
		/** Present after applyFiles — number of files updated (were differs). */
		updated?: number;
		/** Present after applyFiles — number of files created (were missing). */
		created?: number;
		/** Present after applyFiles — number of files already current (were matches). */
		unchanged?: number;
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

/** Result returned by aide_info — the passive staleness-detection surface. */
export interface InfoResult {
	/** The npm package version of the installed aide MCP server. */
	serverVersion: string;
	/** Artifact keys whose sourceCommit differs between local and canonical. */
	outdated: string[];
}

/** A single symbol match returned by aide_inspect. */
export interface InspectHit {
	/** Symbol name as declared in source. */
	name: string;
	/** Symbol kind — one of "function", "method", "arrow", "class", "interface", "type-alias". */
	kind: string;
	/** Path relative to project root, POSIX-normalized. */
	file: string;
	/** 1-based line number where the symbol is declared. */
	line: number;
	/**
	 * Full declaration text truncated before the body — no curly braces from
	 * function/class bodies. Type aliases include the full text up to the `=`
	 * assignment.
	 */
	signature: string;
	/** Parsed JSDoc block, or null when no JSDoc is present. */
	jsdoc: {
		/** Text before any `@` tag. */
		description: string;
		/** Each `@tag text` pair extracted from the JSDoc block. */
		tags: Array<{ tag: string; text: string }>;
	} | null;
}

/** Result returned by aide_inspect — an array because a name may match in multiple files. */
export type InspectResult = {
	hits: InspectHit[];
};

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
