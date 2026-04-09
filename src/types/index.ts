/** The three spec types plus QA checklist. */
export type AideFileType = "intent" | "research" | "todo";

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
}

/** Result of a single init step. */
export interface InitStepResult {
	name: string;
	status: "created" | "exists" | "wired" | "skipped";
}

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
