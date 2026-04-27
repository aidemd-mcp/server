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
	 * Directory for the host-side AIDE methodology doc directory, relative to
	 * the project root. The sibling helpers `writeMethodology` and
	 * `installMethodologyDocs` both derive the host-side doc directory location
	 * from this single field — the stub names the path, the installer writes into
	 * it, and any disagreement between the two sides would send agents to an
	 * empty directory. Editing this value is the one-place change for the
	 * host-side doc directory location across the init subtree.
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
	/** The mcpServers key name (e.g. "aide", "brain"). */
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
 *
 * Planning outcomes (returned by the dry-run phase before any writes):
 * - `"would-create"` — target path does not exist; the tool will write it.
 * - `"would-overwrite"` — target path exists but its bytes differ from
 *   canonical; the agent must prompt the user before the tool writes.
 * - `"would-skip"` — the tool deliberately declines to act (e.g. canonical
 *   read failed, VS Code CLI absent, Zed JSON parse failure). Not the same
 *   as a file that is already at canonical bytes.
 * - `"exists"` — target path exists and its bytes match canonical (or the
 *   step is already satisfied). Nothing to do.
 *
 * Execution outcomes (returned by applySteps after writes):
 * - `"created"` — the tool wrote a `would-create` step to disk.
 * - `"overwritten"` — the tool wrote a `would-overwrite` step to disk after
 *   the agent obtained user approval for the category.
 */
export type InitStepStatus =
	| "would-create"
	| "would-skip"
	| "would-overwrite"
	| "exists"
	| "created"
	| "overwritten";

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
	/**
	 * File content to write — present for `would-create` AND `would-overwrite`
	 * file steps; absent for `would-skip` and `exists` steps. Planning helpers
	 * must carry the canonical bytes for overwrites too so that `applySteps`
	 * can write them when the agent proceeds after user approval.
	 */
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
 * A discovered brain root candidate returned by resolveBrainHints.
 * The agent presents these as suggestions and asks the user to confirm
 * or provide a different path.
 */
export interface BrainHint {
	/** How this path was discovered. */
	source: "env" | "sibling" | "conventional";
	/** Absolute path to the candidate brain root location. */
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
	/** Discovered brain root candidates for the brain interview. */
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

/**
 * The canonical MCP-server entry shape consumed by the shared `writeMcpEntry` helper.
 * Represents a single server entry under `mcpServers[<key>]` in `.mcp.json`.
 * Also used by `buildBrainState` when comparing the parsed `brain.aide` expected
 * entry against the actual entry in the host's `.mcp.json`.
 */
export type McpServerEntry = {
	command: string;
	args: string[];
};

/**
 * Precondition state of the host's brain, returned as a four-state tagged
 * union so the orchestrator can branch on each case and compose targeted
 * remediation prose. `buildBrainState` is the single source of this value;
 * both `aide_brain` and `aide_info` consume the same plain-data shape without
 * re-deriving detection logic.
 *
 * Discriminant invariants:
 *
 * - `ok` — `.aide/brain.aide` parsed successfully and the host's `.mcp.json`
 *   `mcpServers.brain` entry matches the parsed/interpolated `mcpServerConfig`.
 *   Carries `name` (the user-declared descriptive label from brain.aide —
 *   descriptive only, never dispatched on by any code) and `hints`.
 *
 * - `no-brain-aide` — `parseBrainAide` returned `missing`, `malformed-frontmatter`,
 *   or `malformed-body`. All three sub-cases collapse to this status: the file is
 *   unusable and there is nothing to read a label from. Carries only `hints` —
 *   no `name`. Remediation: fix or create `.aide/brain.aide`.
 *
 * - `no-mcp-entry` — brain.aide parsed successfully, but the host's `.mcp.json`
 *   cannot be read (ENOENT or any I/O failure), cannot be parsed as JSON, or has
 *   no `mcpServers.brain` key. Carries `name` (from the parsed brain.aide) and
 *   `hints`. Remediation: run `npx aidemd-mcp sync`.
 *
 * - `mcp-drift` — brain.aide parsed, `.mcp.json` has a `brain` entry, but the
 *   entry's `command` or `args` differ from the parsed/interpolated
 *   `mcpServerConfig`. Drift is detected by structural comparison (string equality
 *   on `command`; element-by-element equality on `args`). Carries `name` and
 *   `hints`. Remediation: run `npx aidemd-mcp sync`.
 *
 * `hints` is populated unconditionally on every state — the orchestrator may
 * surface candidate brain root locations on `no-brain-aide` (fresh project) just as
 * much as on `mcp-drift`. No state carries `rootPath`, `connector`, `entryFile`,
 * `tools`, or `backend` — those fields are retired. Path validity is the
 * launcher's problem at MCP server startup.
 */
export type BrainState =
	| {
			status: "ok";
			/** User-declared descriptive label from brain.aide (e.g. `"obsidian"`). Descriptive only — no code branches on this value. */
			name: string;
			/** Candidate brain root locations for orchestrator remediation suggestions. */
			hints: BrainHint[];
	  }
	| {
			status: "no-brain-aide";
			/** Candidate brain root locations for orchestrator remediation suggestions. */
			hints: BrainHint[];
	  }
	| {
			status: "no-mcp-entry";
			/** User-declared descriptive label from brain.aide. Carried so the orchestrator can name the wired brain in remediation prose. */
			name: string;
			/** Candidate brain root locations for orchestrator remediation suggestions. */
			hints: BrainHint[];
	  }
	| {
			status: "mcp-drift";
			/** User-declared descriptive label from brain.aide. Carried so the orchestrator can name the wired brain in remediation prose. */
			name: string;
			/** Candidate brain root locations for orchestrator remediation suggestions. */
			hints: BrainHint[];
	  };

/**
 * The structured JSON result returned by `aide_brain` — the runtime brain
 * entry-point tool.
 *
 * - `status` mirrors `BrainState["status"]` exactly, so an agent that already
 *   saw boot-time brain state from `aide_info` does not learn new terms.
 * - `instructions` is always non-empty — ready-to-execute prose composed by the
 *   server. On `"ok"`, it tells the agent which MCP tools to call and how to
 *   reach the wired backend's seeded entry-point file. On non-ok branches, it
 *   carries remediation prose directing the agent to surface a wiring prompt to
 *   the user. A response with `status: "ok"` and empty `instructions` is a
 *   forbidden state.
 */
export type BrainToolResult = {
	status: BrainState["status"];
	instructions: string;
};

/**
 * Result returned by aide_info — the passive boot-time reporter.
 *
 * Returns two independent top-level fields, each covering a distinct concern:
 * - `serverVersion` + `outdated`: staleness of installed AIDE artifacts against
 *   the canonical manifest shipped with this npm package. Soft notification —
 *   the pipeline can run even when artifacts are stale.
 * - `brain`: precondition state of the host's brain MCP setup. Hard
 *   gate — the orchestrator halts and directs the user to run `/aide` when
 *   `status` is anything other than `"ok"`; the inline-recovery flow detects
 *   the broken state and prompts the user to resolve it.
 *
 * The two fields are structurally independent: the orchestrator reads each
 * field in isolation and applies a different policy to each.
 */
export interface InfoResult {
	/** The npm package version of the installed aide MCP server. */
	serverVersion: string;
	/** Artifact keys whose sourceCommit differs between local and canonical. */
	outdated: string[];
	/** Precondition state of the host's brain. */
	brain: BrainState;
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

/**
 * The `mcpServerConfig` block parsed from `brain.aide` frontmatter. Mirrors
 * the shape of `McpServerEntry` but is kept as a separate type because `args`
 * may contain `${name}` placeholder strings pre-interpolation — that semantic
 * detail is visible at the type boundary and documents that callers must run
 * `interpolateArgs` before writing the entry to `.mcp.json`. Consumed by
 * `parseBrainAide` (parsing and validation) and `interpolateArgs`
 * (substitution).
 */
export type BrainAideMcpServerConfig = {
	command: string;
	args: string[];
};

/**
 * The two-field parsed frontmatter of a `brain.aide` file. Format reference:
 * `.aide/docs/brain-aide.md`. Validated by `parseBrainAide`; a missing or
 * wrong-typed field, or the presence of any deprecated field (`connector`,
 * `rootPath`, `entryFile`, `tools`), produces a `malformed-frontmatter` result
 * rather than a partial config.
 *
 * `name` is descriptive metadata — a user-supplied label that surfaces in
 * `aide_info` output. It is never branched on by any package code; different
 * brains may share names without affecting behavior.
 *
 * Consumed by `buildBrainState`, the brain tool, `provisionBrain`, and
 * `cli/sync`.
 */
export type BrainAideConfig = {
	/** User-supplied descriptive label for the brain; never dispatched on by the package. */
	name: string;
	/** MCP server configuration, with args that may contain `${name}` placeholders. */
	mcpServerConfig: BrainAideMcpServerConfig;
};

/**
 * Tagged-result union returned by `parseBrainAide` and `parseBrainAideFromString`.
 * The discriminant is `kind`. Consumers narrow on `kind` to handle each outcome:
 *
 * - `"ok"` — the file was found, frontmatter parsed cleanly, all required fields
 *   validated, and the body contained exactly the three required marker-pair
 *   sections in their required order. `config` is the full parsed frontmatter.
 *   `prose`, `playbook`, and `research` each carry the verbatim bytes between
 *   their opening marker and matching closing marker — byte-identical to what the
 *   user wrote between those bounds. No substitution runs on any body field.
 *
 *   The three recognized marker pairs, in required order:
 *   - `<!-- aide-prose-start -->` / `<!-- aide-prose-end -->`
 *   - `<!-- aide-playbook-start -->` / `<!-- aide-playbook-end -->`
 *   - `<!-- aide-research-start -->` / `<!-- aide-research-end -->`
 *
 *   Marker tokens are lowercase, case-sensitive, with the literal shape
 *   `<!-- <token>-start -->` / `<!-- <token>-end -->` exactly. Bytes outside any
 *   marker pair are silently ignored.
 *
 * - `"missing"` — `.aide/config/brain.aide` does not exist at the given root (or
 *   was unreachable due to an I/O error). Remediation: run `/aide` and complete
 *   the brain wiring interview.
 *
 * - `"malformed-frontmatter"` — the file exists but its YAML frontmatter could
 *   not be parsed, a required field (`name`, `mcpServerConfig.command`,
 *   `mcpServerConfig.args`) is absent or wrong-typed, or a deprecated field
 *   (`connector`, `rootPath`, `entryFile`, `tools`) is present. `reason` names
 *   the exact field or parse error so the consumer can surface a targeted
 *   remediation message to the user.
 *
 * - `"malformed-body"` — frontmatter is valid but the body fails the closed
 *   marker-pair grammar. `reason` names the violating marker. Violation classes:
 *   - Missing pair → `"missing markers: <opener>, <closer>"` (lists every absent
 *     marker in fixed prose-then-playbook-then-research scan order, open before
 *     close within each section).
 *   - Malformed or typo'd marker token (uppercase, mixed-case, missing internal
 *     spaces, extra internal whitespace, typo, missing `aide-` prefix) →
 *     `"unknown marker: <as-written>"`.
 *   - Closing marker without a prior matching opener →
 *     `"unmatched closing marker: <closer> appeared without a prior <matching-opener>"`.
 *   - Opening marker without a closer →
 *     `"unmatched opening marker: <opener> has no matching <expected-closer>"`.
 *   - Wrong section order →
 *     `"marker order violation: <out-of-order-opener> appeared before <expected-prior-opener>"`.
 *   - Nested markers (any marker inside another pair's opener-closer span) →
 *     `"nested marker: <inner-opener> appeared inside the <outer-token> section"`.
 *
 *   Every violation halts the pipeline; the parser does not attempt recovery.
 *   Consumed by `buildBrainState`, the brain tool, `provisionBrain`, and
 *   `cli/sync` to compose branch-specific remediation prose.
 */
export type ParseBrainAideResult =
	| { kind: "ok"; config: BrainAideConfig; prose: string; playbook: string; research: string }
	| { kind: "missing" }
	| { kind: "malformed-frontmatter"; reason: string }
	| { kind: "malformed-body"; reason: string };

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
