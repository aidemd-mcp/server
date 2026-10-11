import type { BrainSectionContractEntry, BrainSectionField, BrainSectionMarker } from "@/service/brainContract/index.js";

export type { BrainSectionContractEntry, BrainSectionField, BrainSectionMarker } from "@/service/brainContract/index.js";

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

/** How an MCP server entry launches. Global runs the installed command; local runs it through npx. */
export type LaunchMode = "global" | "local";

/** Whether a package is installed globally, and the command that would install it. */
export type GlobalPackageStatus = {
	name: string;
	installed: boolean;
	installCommand: string;
};

/** The globally installed aide server's version versus the latest published version. */
export type BehindNotice = { installed: string; latest: string };

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
	/**
	 * The server entry to merge into mcpServers. `args` is `(string | null)[]` — null
	 * entries at any index are the explicit unwired-slot signal forwarded verbatim from
	 * brain.aide via parseBrainAide + interpolateArgs. Sync refuses to write a null-bearing
	 * entry; the null must be filled by the user before sync runs.
	 */
	entry: { command: string; args: (string | null)[] };
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
	 * Present only on the aide MCP step when the step was planned in global
	 * mode and would create the entry.
	 */
	globalPackage?: GlobalPackageStatus;
	/**
	 * CLI command the agent should execute for steps that require external
	 * tooling (e.g. `code --install-extension <vsixPath>` for VS Code).
	 * Present only on `would-create` IDE VS Code steps that pass through
	 * applySteps without being written to disk.
	 */
	instructions?: string;
	/**
	 * Content-free summary of the brain config. Present only on the brain config
	 * (brain.aide) step, on every status. Carries no section text, purposes,
	 * repair blocks or migration bodies.
	 */
	brainSummary?: BrainStepSummary;
}

/**
 * One contract section as the `InitStep.brainSummary` reports it. `seedPath` is
 * present only on seed entries. `templateBytes` is the UTF-8 byte length of the
 * latest bundled template's section (the bytes strictly between its markers).
 */
export type BrainStepSection = {
	marker: BrainSectionMarker;
	role: "live" | "seed";
	seedPath?: string;
	templateBytes: number;
};

/**
 * Content-free summary of the brain config carried on `InitStep.brainSummary`.
 * `sections` is the contract in order. `missingSections` and `staleSections`
 * name markers only. `legacyLauncher` lists the reasons the launcher is legacy,
 * or `null`. `templateIntegration` is whether the launcher is the bundled
 * template integration, or `null` when the file is absent or unparseable. A
 * would-create step, and an unparseable file, report empty arrays and `null`s.
 */
export type BrainStepSummary = {
	sections: BrainStepSection[];
	missingSections: BrainSectionMarker[];
	staleSections: BrainSectionMarker[];
	legacyLauncher: LegacyLauncherReason[] | null;
	templateIntegration: boolean | null;
};

/**
 * One absent brain config section plus the bytes and position needed to insert
 * it. `block` is the full marker-wrapped section, byte-identical to the latest
 * bundled template. `insertAfter` is the exact close-marker text the block goes
 * directly after, or `null` for the start of the body. Consumed by aide_upgrade's
 * brain insertion, not by the agent. Insertion semantics are defined in
 * provisionBrain brief commitment #6.
 */
export type BrainSectionRepair = BrainSectionContractEntry & {
	block: string;
	insertAfter: string | null;
};

/**
 * Why a brain launcher counts as legacy. `unpinned` and `unversioned` mean the
 * npx package spec carries no version; `older-pin` means it pins a version
 * older than this server; `missing-auto-confirm` means the npx args lack the
 * auto-confirm flag. Produced by provisionBrain's launcher check; consumed by
 * `BrainLauncherOffer`, `BrainMigrationNotice` and `UpgradeFileResult`.
 */
export type LegacyLauncherReason = "unpinned" | "unversioned" | "older-pin" | "missing-auto-confirm";

/**
 * A proposed launcher rewrite for a legacy brain launcher. `before` is the
 * user's `mcpServerConfig` as parsed; `after` is the replacement for each
 * launch mode. Produced by provisionBrain; consumed by aide_upgrade's brain
 * preview and apply via `BrainMigration`, no longer carried on `InitStep`.
 */
export type BrainLauncherOffer = {
	reasons: LegacyLauncherReason[];
	before: BrainAideMcpServerConfig;
	after: Record<LaunchMode, BrainAideMcpServerConfig>;
};

/**
 * One stale brain config section plus its replacement. `before` and `after`
 * are the bytes strictly between that section's markers: `before` is the
 * user's, verbatim, and `after` is the latest bundled template's. Produced by
 * provisionBrain; consumed by aide_upgrade's brain preview and apply via
 * `BrainMigration`, no longer carried on `InitStep`.
 */
export type BrainStaleSectionOffer = BrainSectionContractEntry & {
	before: string;
	after: string;
};

/**
 * Everything aide_init offers to migrate in an existing brain config: stale
 * sections and a legacy launcher. Produced by provisionBrain and consumed by
 * aide_upgrade's brain preview and apply; no longer carried on `InitStep`. Each
 * change is applied only after the user says yes to it.
 */
export type BrainMigration = {
	staleSections: BrainStaleSectionOffer[];
	legacyLauncher: BrainLauncherOffer | null;
};

/**
 * Content-free summary of a `BrainMigration`: marker names and launcher
 * reasons only, never section or launcher bytes. Produced by buildBrainState's
 * callers; consumed by aide_info (`InfoResult.brainMigration`), which stays
 * small, and mirrored by aide_upgrade's brain result.
 */
export type BrainMigrationNotice = {
	staleSections: BrainSectionMarker[];
	legacyLauncher: LegacyLauncherReason[] | null;
};

/** What a brain change touches, or what a template read selects: one contract section, or the launcher. */
export type BrainChangeTarget = BrainSectionMarker | "launcher";

/**
 * Result of aide_upgrade's `category: "brain"`, discriminated on `outcome`.
 * `beforeHash` is the lowercase hex SHA-256 of `before` as UTF-8, so the agent
 * never computes a hash.
 */
export type BrainCategoryResult =
	/** Missing contract sections were inserted into brain.aide; lists their markers. */
	| { outcome: "inserted"; inserted: BrainSectionMarker[] }
	/** Inserted seed sections need adapting to this brain; `instructions` says how. */
	| { outcome: "adapt"; adapt: BrainSectionMarker[]; instructions: string }
	/** One previewed change: `before` is the exact text hashed into `beforeHash`, `after` the replacement. */
	| { outcome: "change"; target: BrainChangeTarget; before: string; after: string; beforeHash: string }
	/** The target section is absent from the file; `template` is the bundled section to insert. */
	| { outcome: "missing"; target: BrainSectionMarker; template: string; instructions: string }
	/** The hash-guarded change was written to brain.aide. */
	| { outcome: "applied"; target: BrainChangeTarget }
	/** The request was refused; `instructions` says why and what to do. */
	| { outcome: "refused"; instructions: string };

/**
 * Internal to aide_upgrade's brain category. `before` is the exact text hashed
 * into `beforeHash`; `after` is in the file's line ending; `text` is the whole
 * file with the change spliced in (not yet validated or written).
 */
export type BrainChangeOffer =
	| { kind: "offer"; target: BrainChangeTarget; before: string; after: string; text: string }
	| { kind: "refused"; instructions: string };

/**
 * One recorded outdated version of a bundled template section: the fingerprint
 * of its normalized text and the release it was seen in. A section is stale
 * when its fingerprint matches one of these and is not the current template's.
 * Consumed by provisionBrain's staleness check.
 */
export type OutdatedSectionVersion = {
	fingerprint: string;
	seenIn: string;
};

/**
 * Where the npx package spec sits in a brain launcher's args. Both
 * `argsStart` and `specIndex` are absolute indexes into
 * `mcpServerConfig.args`. Produced and consumed by provisionBrain's launcher
 * check and rewrite.
 */
export type NpxPackageSpec = {
	argsStart: number;
	specIndex: number;
	packageName: string;
	version: string | null;
	autoConfirm: boolean;
};

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
	| "readme"
	| "brain";

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
	 * An informational note on a file result. It is neither drift nor a
	 * prescription, and it never changes the summary counts.
	 */
	tip?: string;
	/**
	 * CLI command the agent should execute for steps that require external
	 * tooling (e.g. `code --install-extension <vsixPath>` for VS Code).
	 * Present only on IDE VS Code steps that pass through applyFiles without
	 * being written to disk.
	 */
	instructions?: string;
	/**
	 * Marker names of the required sections absent from the brain config, in
	 * contract order. Present only on the brain category file result when the
	 * config is behind.
	 */
	missingSections?: BrainSectionMarker[];
	/**
	 * Marker names of the sections whose bytes match an outdated template
	 * version. Present only on the brain category file result. Names only,
	 * never section bytes.
	 */
	staleSections?: BrainSectionMarker[];
	/**
	 * Reasons the brain launcher is legacy. Present only on the brain category
	 * file result. Reasons only, never launcher bytes.
	 */
	legacyLauncher?: LegacyLauncherReason[];
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
	/**
	 * Args typed `(string | null)[]` to match the broadened parser contract.
	 * Null entries are unwired-slot signals forwarded verbatim from brain.aide;
	 * sync refuses to write null-bearing entries.
	 */
	args: (string | null)[];
};

/**
 * Why a present `brain.aide` falls short of the contract. This is the
 * "present but falls short" detail and never means absence: an absent file is
 * `no-brain-aide`, not a fault.
 *
 * - `missing-sections` - every present marker pair is sound but one or more
 *   whole required pairs are absent. `sections` is non-empty, in contract order.
 * - `malformed` - the frontmatter or body is unusable; `reason` names the
 *   exact field, parse error or violating marker.
 */
export type BrainAideFault =
	| { kind: "missing-sections"; sections: BrainSectionMarker[] }
	| { kind: "malformed"; reason: string };

/**
 * Precondition state of the host's brain, returned as a five-state tagged
 * union so the orchestrator can branch on each case and compose targeted
 * remediation prose. `buildBrainState` is the single source of this value;
 * both `aide_brain` and `aide_info` consume the same plain-data shape without
 * re-deriving detection logic.
 *
 * Discriminant invariants:
 *
 * - `ok` - `.aide/config/brain.aide` parsed successfully and the host's `.mcp.json`
 *   `mcpServers.brain` entry matches the parsed/interpolated `mcpServerConfig`.
 *   Carries `name` (the user-declared descriptive label from brain.aide -
 *   descriptive only, never dispatched on by any code) and `hints`.
 *
 * - `no-brain-aide` - the file is absent (ENOENT), and only that. A present file
 *   that cannot be read is `brain-aide-invalid`, never this status. There is
 *   nothing to read a label from. Carries only `hints` - no `name`.
 *   Remediation: `/aide:brain config`.
 *
 * - `brain-aide-invalid` - the file is present but falls short of the contract:
 *   missing sections, malformed frontmatter, malformed body, or unreadable. Carries the
 *   `fault` detail and `hints` - no `name`. Remediation: missing sections are
 *   inserted with `aide_upgrade` `category: "brain"`; a malformed file is fixed by hand.
 *
 * - `no-mcp-entry` - brain.aide parsed successfully, but the host's `.mcp.json`
 *   cannot be read (ENOENT or any I/O failure), cannot be parsed as JSON, or has
 *   no `mcpServers.brain` key. Carries `name` (from the parsed brain.aide) and
 *   `hints`. Remediation: run sync with the launcher the project's `aide` MCP entry uses.
 *
 * - `mcp-drift` - brain.aide parsed, `.mcp.json` has a `brain` entry, but the
 *   entry's `command` or `args` differ from the parsed/interpolated
 *   `mcpServerConfig`. Drift is detected by structural comparison (string equality
 *   on `command`; element-by-element equality on `args`). Carries `name` and
 *   `hints`. Remediation: run sync with the launcher the project's `aide` MCP entry uses.
 *
 * `hints` is populated unconditionally on every state - the orchestrator may
 * surface candidate brain root locations on `no-brain-aide` (fresh project) just as
 * much as on `mcp-drift`. No state carries `rootPath`, `connector`, `entryFile`,
 * `tools`, or `backend` - those fields are retired. Path validity is the
 * launcher's problem at MCP server startup.
 */
export type BrainState =
	| {
			status: "ok";
			/** User-declared descriptive label from brain.aide (e.g. `"obsidian"`). Descriptive only - no code branches on this value. */
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
			status: "brain-aide-invalid";
			/** What the present file is missing or what makes it malformed. */
			fault: BrainAideFault;
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
 * - `instructions` is always non-empty. On `"ok"`, it is the requested section's
 *   text. On a remediation branch it is prose composed by the server directing
 *   the agent to surface a wiring prompt to the user. A readable non-ok config
 *   can still return a section. A response with `status: "ok"` and empty
 *   `instructions` is a forbidden state.
 * - `found` says what `instructions` carries.
 * - `purpose` is the requested section's one-line purpose from the published
 *   `brainContract`; present only when `found` is true, absent on every
 *   remediation branch.
 */
export type BrainToolResult = {
	status: BrainState["status"];
	instructions: string;
	/**
	 * True only when `instructions` is the requested section's verbatim bytes;
	 * false on every remediation branch. Never derived from `status`.
	 */
	found: boolean;
	/**
	 * The requested section's one-line purpose, read from the published
	 * `brainContract` entry for that marker (never from the user's brain.aide).
	 * Present only when `found` is true; the key is absent on every remediation
	 * branch.
	 */
	purpose?: string;
};

/**
 * Result of an `aide_brain` template read. Produced by the template mode of
 * `aide_brain`; consumed by the agent and the `aide-brain-author` skill as the
 * worked example for one contract section or the launcher. Carries no `status`
 * and no `found`: the answer does not depend on the host's config.
 */
export type BrainTemplateResult = {
	/** The bundled template's verbatim bytes for one contract section (strictly between its markers) or for the launcher (the frontmatter region). */
	template: string;
	/** That section's contract purpose, or the launcher purpose. */
	purpose: string;
};

/**
 * One section in an `aide_brain` contract listing. Produced by the contract
 * mode of `aide_brain`; consumed by the agent and the `aide-brain-author`
 * skill. Carries no `field`, no `seedPath` and no text.
 */
export type BrainContractSection = {
	marker: BrainSectionMarker;
	role: BrainSectionContractEntry["role"];
	purpose: BrainSectionContractEntry["purpose"];
};

/**
 * Result of an `aide_brain` contract listing. Produced by the contract mode of
 * `aide_brain`; consumed by the agent and the `aide-brain-author` skill.
 */
export type BrainContractListing = {
	/** Every contract section, in contract order. */
	sections: BrainContractSection[];
};

/**
 * What the structural check found at a draft path. Produced by the draft
 * validation mode of `aide_brain`; consumed by the agent and the
 * `aide-brain-author` skill. The fault arm reuses the host check's
 * `BrainAideFault` vocabulary unchanged.
 */
export type BrainDraftFinding = { kind: "valid" } | { kind: "absent" } | BrainAideFault;

/**
 * Result of an `aide_brain` draft validation, discriminated on `outcome` (the
 * discriminant `BrainCategoryResult` already uses). `fault` is carried only on
 * `invalid`, so a found flag can never disagree with the text.
 *
 * - `valid` - the draft passes the structural check.
 * - `invalid` - the draft is present but falls short; `fault` says how.
 * - `absent` - nothing exists at the draft path.
 * - `refused` - the path is outside the project; nothing was read.
 */
export type BrainDraftResult =
	| { outcome: "valid"; instructions: string }
	| { outcome: "invalid"; fault: BrainAideFault; instructions: string }
	| { outcome: "absent"; instructions: string }
	| { outcome: "refused"; instructions: string };

/**
 * Result returned by aide_info — the passive boot-time reporter.
 *
 * Returns three independent top-level fields, each covering a distinct concern:
 * - `serverVersion` + `outdated`: staleness of installed AIDE artifacts against
 *   the canonical manifest shipped with this npm package. Soft notification —
 *   the pipeline can run even when artifacts are stale.
 * - `brain`: precondition state of the host's brain MCP setup. Hard
 *   gate — the orchestrator halts and directs the user to run `/aide` when
 *   `status` is anything other than `"ok"`; the inline-recovery flow detects
 *   the broken state and prompts the user to resolve it.
 * - `brainMigration`: whether the brain config carries stale sections or a
 *   legacy launcher. Soft notice, independent of `brain`, never a gate.
 *
 * The fields are structurally independent: the orchestrator reads each
 * field in isolation and applies a different policy to each.
 */
export interface InfoResult {
	/** The npm package version of the installed aide MCP server. */
	serverVersion: string;
	/** Artifact keys whose sourceCommit differs between local and canonical. */
	outdated: string[];
	/**
	 * A soft notice, independent of `outdated`. It is null when not applicable
	 * or unknown.
	 */
	behind: BehindNotice | null;
	/** Precondition state of the host's brain. */
	brain: BrainState;
	/**
	 * A soft notice, independent of `brain`, and never a gate. It names the stale
	 * sections and legacy launcher reasons in the brain config and carries no
	 * section or launcher bytes. It is null when nothing is stale or the config
	 * cannot be checked.
	 */
	brainMigration: BrainMigrationNotice | null;
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
 * The three pipeline ephemerals aide_cleanup may remove; nothing else is ever
 * a removal target. session.aide is deliberately not a member — it is the
 * project-wide session log and survives every cleanup call.
 */
export type CleanupEphemeral = "plan.aide" | "todo.aide" | "brief.aide";

/** The two ephemerals whose checkboxes gate removal. */
export type CheckedEphemeral = Extract<CleanupEphemeral, "plan.aide" | "todo.aide">;

/**
 * One unchecked item: the file it sits in, its 1-based line number, and the
 * item text after the checkbox marker, trimmed.
 */
export type OpenCheckbox = {
	file: CheckedEphemeral;
	line: number;
	text: string;
};

/**
 * Why aide_cleanup refused to touch a module. A typed union rather than a
 * string so a refusal can never omit the unchecked items it must name.
 */
export type CleanupRefusal =
	/** The named path resolves outside the project root (via `..`, an absolute path, or a symlink or junction). */
	| { kind: "outside-root" }
	/** Nothing exists at the named path. */
	| { kind: "missing" }
	/** The named path is a file or other non-directory. */
	| { kind: "not-a-directory" }
	/** An ephemeral name exists but is not a regular file (directory, symlink). */
	| { kind: "not-a-file"; file: CleanupEphemeral }
	/** The module has no plan.aide. */
	| { kind: "no-plan" }
	/**
	 * plan.aide exists but contains no checkbox, so completion cannot be
	 * verified. This is the default; the caller can lift it only by passing
	 * `allowEmptyPlan: true`.
	 */
	| { kind: "plan-without-checkboxes" }
	/** At least one unchecked item. `items` is non-empty: plan.aide items first, then todo.aide items, each in line order. */
	| { kind: "unchecked-items"; items: OpenCheckbox[] };

/**
 * Result returned by aide_cleanup. Every variant carries `module`, the module
 * path as displayed to the caller: POSIX-separated and relative to the root
 * (`"."` for the root itself). For `outside-root` it is the caller's input verbatim.
 */
export type CleanupResult =
	/** Real call succeeded. `files` lists what was removed, in removal order. */
	| { kind: "removed"; module: string; files: CleanupEphemeral[] }
	/** Dry run. `files` is exactly what the real call would remove against the same state. */
	| { kind: "would-remove"; module: string; files: CleanupEphemeral[] }
	/** Preconditions failed. Nothing was touched. */
	| { kind: "refused"; module: string; refusal: CleanupRefusal }
	/** A removal failed partway: names what is gone, what is left, and the underlying error message. */
	| {
			kind: "incomplete";
			module: string;
			removed: CleanupEphemeral[];
			remaining: CleanupEphemeral[];
			error: string;
	  };

/**
 * The `mcpServerConfig` block parsed from `brain.aide` frontmatter. Kept as a
 * separate type from `McpServerEntry` because `args` is `(string | null)[]` at
 * parse time — every element is either a fully-formed argument string OR YAML
 * null. A null at any index is the explicit unwired-slot signal, replacing the
 * retired literal-sentinel design (no `<BRAIN_PATH>`, `<API_TOKEN>`, magic
 * UUIDs, or other string sentinels are recognized at any layer). The parser
 * preserves null entries verbatim at their original indexes; downstream
 * consumers branch on null structurally per their own contracts: sync refuses
 * to proceed when any arg is null, `buildBrainState` maps any null entry to
 * the `no-mcp-entry` semantic, and `interpolateArgs` passes null through
 * unchanged at its original index. Callers must run `interpolateArgs` before
 * writing the entry to `.mcp.json` — the post-interpolation shape that sync
 * writes is `McpServerEntry`, which carries `args: string[]` and only ever
 * holds fully-resolved values. Consumed by `parseBrainAide` (parsing and
 * validation) and `interpolateArgs` (substitution).
 */
export type BrainAideMcpServerConfig = {
	command: string;
	args: (string | null)[];
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
 * `mcpServerConfig.args` is `(string | null)[]` — every element is either a
 * fully-formed argument string OR YAML null. A null at any index is the
 * explicit unwired-slot signal; the parser preserves null entries verbatim at
 * their original indexes through to consumers. Downstream consumers
 * (`cli/sync`'s null-refusal, `buildBrainState`'s null-detection,
 * `interpolateArgs`'s null-passthrough) branch on null structurally.
 *
 * Consumed by `buildBrainState`, the brain tool, `provisionBrain`, and
 * `cli/sync`.
 */
export type BrainAideConfig = {
	/** User-supplied descriptive label for the brain; never dispatched on by the package. */
	name: string;
	/**
	 * MCP server configuration, with args typed `(string | null)[]`. String elements
	 * may contain `${name}` placeholders resolved by `interpolateArgs`; null elements
	 * are unwired-slot signals that pass through unchanged at their original index.
	 */
	mcpServerConfig: BrainAideMcpServerConfig;
};

/**
 * Tagged-result union returned by `parseBrainAide` and `parseBrainAideFromString`.
 * The discriminant is `kind`. Consumers narrow on `kind` to handle each outcome.
 * The required sections, their order and their marker names come from
 * `brainContract` (`src/service/brainContract`); this type derives from it and
 * never restates the list.
 *
 * - `"ok"` - the file was found, frontmatter parsed cleanly, all required fields
 *   validated, and the body carried every contract section in order. `name` and
 *   `mcpServerConfig` are the flattened frontmatter fields sitting as siblings of
 *   the section fields. Each section field carries the verbatim bytes between its
 *   opening marker and matching closing marker, with no substitution. Bytes
 *   outside any marker pair are silently ignored.
 *
 * - `"missing"` - `.aide/config/brain.aide` does not exist at the given root
 *   (ENOENT only).
 *
 * - `"unreadable"` - the file exists but could not be read (EACCES, EISDIR, any
 *   non-ENOENT I/O failure). `reason` names the read error. Consumers treat it as
 *   a fault, never as absence.
 *
 * - `"malformed-frontmatter"` - the file exists but its YAML frontmatter could
 *   not be parsed, a required field is absent or wrong-typed, or a deprecated
 *   field is present. `reason` names the exact field or parse error.
 *
 * - `"malformed-body"` - frontmatter is valid but a present marker pair is
 *   structurally unsound: unknown or mistyped marker token, unmatched opening or
 *   closing marker (a half-present pair), wrong section order, or nested
 *   markers. `reason` names the violating marker. Wholly absent pairs are not
 *   this kind; they are `"missing-sections"`.
 *
 * - `"missing-sections"` - every present marker pair is structurally sound and
 *   one or more whole pairs are absent. `sections` is non-empty and in contract
 *   order. The present sections' bytes are carried verbatim in `present`
 *   (absent ones are left out of the record), and `name` and `mcpServerConfig`
 *   are carried exactly as on `"ok"`, so an old-shape file can still be checked
 *   for stale sections and a legacy launcher.
 */
export type ParseBrainAideResult =
	| ({
			kind: "ok";
			/** User-supplied descriptive label from brain.aide frontmatter; never dispatched on by the package. */
			name: string;
			/** MCP server configuration from brain.aide frontmatter, with args that may contain `${name}` placeholders. */
			mcpServerConfig: BrainAideMcpServerConfig;
	  } & Record<BrainSectionField, string>)
	| { kind: "missing" }
	| { kind: "unreadable"; reason: string }
	| { kind: "malformed-frontmatter"; reason: string }
	| { kind: "malformed-body"; reason: string }
	| {
			kind: "missing-sections";
			sections: BrainSectionMarker[];
			/** User-supplied descriptive label from brain.aide frontmatter; never dispatched on by the package. */
			name: string;
			/** MCP server configuration from brain.aide frontmatter, carried exactly as on `"ok"`. */
			mcpServerConfig: BrainAideMcpServerConfig;
			/** Verbatim bytes between the markers of every section that is present; absent sections are left out. */
			present: Partial<Record<BrainSectionField, string>>;
	  };

/**
 * One marker token located in the brain.aide body by the parser's scan.
 * Consumed only by `src/service/parseBrainAide/extractMarkerSections`.
 */
export type LocatedMarker = {
	/** Whether the token is an opening or a closing marker. */
	tokenKind: "open" | "close";
	/** The contract marker name the token belongs to. */
	marker: BrainSectionMarker;
	/** The token text exactly as written in the body. */
	text: string;
	/** Character index of the token in the body. */
	index: number;
};

/**
 * Outcome of the marker walk over the brain.aide body: every section's bytes,
 * a structural violation, or the whole pairs that are absent. Consumed only by
 * `src/service/parseBrainAide/extractMarkerSections`.
 */
export type SectionExtraction =
	| ({ kind: "ok" } & Record<BrainSectionField, string>)
	| { kind: "malformed-body"; reason: string }
	| {
			kind: "missing-sections";
			sections: BrainSectionMarker[];
			/** Verbatim bytes between the markers of every section that is present; absent sections are left out. */
			present: Partial<Record<BrainSectionField, string>>;
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

/** One `args` item of a brain.aide `mcpServerConfig` located in the frontmatter region: its whole source line and its parsed value. */
export type ArgLine = { start: number; end: number; value: string | null };
