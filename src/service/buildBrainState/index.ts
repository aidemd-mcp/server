import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import parseBrainAide, { interpolateArgs } from "@/service/parseBrainAide/index.js";
import type { BrainHint, BrainState } from "@/types/index.js";

/**
 * Resolve the host project's brain vault precondition state into a five-state
 * tagged union. Never throws — every failure mode collapses to a structured
 * `BrainState` value with targeted remediation vocabulary.
 *
 * The detection pipeline, in order:
 *
 * 1. **Parse `brain.aide`** via `parseBrainAide(root)`. Any non-`ok` result
 *    (`missing`, `malformed-frontmatter`, `malformed-body`) → `no-brain-aide`.
 *    Without a usable brain.aide there is no `rootPath` or `connector` to
 *    thread into downstream branches.
 *
 * 2. **Stat `rootPath`**. Stat failure or non-directory → `invalid-path`.
 *    The configured-but-unresolvable path is carried forward so the orchestrator
 *    can name it in remediation prose.
 *
 * 3. **Read `.mcp.json`** at the framework-derived `mcpConfigPath`. ENOENT or
 *    any I/O failure → `no-mcp-entry`. JSON parse failure or missing
 *    `mcpServers.brain` key → `no-mcp-entry`. Remediation: run
 *    `npx aidemd-mcp sync`.
 *
 * 4. **Drift comparison**. Compute the expected entry from brain.aide via
 *    `interpolateArgs(config)`. Compare `command` (string equality) and `args`
 *    (element-by-element equality) against the actual `.mcp.json` brain entry.
 *    Any deviation → `mcp-drift`. Remediation: run `npx aidemd-mcp sync`.
 *
 * 5. **Happy path** — everything agrees → `ok`.
 *
 * Invariants:
 * - The detector never imports from `brainBackends` and never calls `resolveBackend`.
 * - The detector never branches on `connector` — it is descriptive metadata only.
 * - `hints` is populated unconditionally on every returned state.
 * - Drift is structural (in-memory comparison), not byte-equal on serialized JSON.
 */
export default async function buildBrainState(root: string): Promise<BrainState> {
	// Step 1 — Resolve the framework-specific MCP config path.
	// Pass only `root` so detection defaults to Claude Code on cold projects.
	const frameworkConfig = await detectFramework(root);
	const mcpConfigPath = join(root, frameworkConfig.mcpConfigPath);

	// Step 2 — Discover candidate vault locations for remediation suggestions.
	// Independent read-only operation. Populated unconditionally so hints appear
	// on every returned state regardless of which branch fires.
	const hints: BrainHint[] = await resolveBrainHints(root);

	// Step 3 — Parse brain.aide. All non-ok parse results collapse to no-brain-aide:
	// without a usable source of truth there is no rootPath or connector to thread
	// into any downstream branch. The parser owns the format contract; the detector
	// only branches on the `kind` discriminant.
	const parseResult = await parseBrainAide(root);
	if (parseResult.kind !== "ok") {
		return { status: "no-brain-aide", hints };
	}
	const { config } = parseResult;

	// Step 4 — Stat the declared rootPath. Failure (any error) or non-directory
	// → invalid-path. The configured-but-unresolvable path is carried forward so
	// the orchestrator can name the exact failing path in remediation prose.
	try {
		const pathStat = await stat(config.rootPath);
		if (!pathStat.isDirectory()) {
			return { status: "invalid-path", rootPath: config.rootPath, connector: config.connector, hints };
		}
	} catch {
		return { status: "invalid-path", rootPath: config.rootPath, connector: config.connector, hints };
	}

	// Step 5 — Read .mcp.json at the framework-derived path. ENOENT and all
	// other I/O failures collapse to no-mcp-entry: the user has a brain.aide
	// but no .mcp.json yet — remediation is to run `npx aidemd-mcp sync`.
	let raw: string;
	try {
		raw = await readFile(mcpConfigPath, "utf-8");
	} catch {
		return { status: "no-mcp-entry", rootPath: config.rootPath, connector: config.connector, hints };
	}

	// Step 6 — Parse .mcp.json JSON. Parse failure maps to no-mcp-entry for
	// the same reason: remediation is identical to "entry absent".
	let mcpConfig: unknown;
	try {
		mcpConfig = JSON.parse(raw);
	} catch {
		return { status: "no-mcp-entry", rootPath: config.rootPath, connector: config.connector, hints };
	}

	// Step 7 — Look up mcpServers.brain. Absent or any structural issue → no-mcp-entry.
	// No fallback to a legacy "obsidian" key — fixed-key invariant is settled at install.
	const servers =
		mcpConfig !== null && typeof mcpConfig === "object" && "mcpServers" in mcpConfig
			? (mcpConfig as Record<string, unknown>).mcpServers
			: undefined;

	if (servers === null || typeof servers !== "object" || !("brain" in (servers as object))) {
		return { status: "no-mcp-entry", rootPath: config.rootPath, connector: config.connector, hints };
	}

	const brainEntry = (servers as Record<string, unknown>).brain;

	if (brainEntry === null || typeof brainEntry !== "object") {
		return { status: "no-mcp-entry", rootPath: config.rootPath, connector: config.connector, hints };
	}

	const entryRecord = brainEntry as Record<string, unknown>;
	const actualCommand = typeof entryRecord.command === "string" ? entryRecord.command : undefined;
	const actualArgs = Array.isArray(entryRecord.args) ? (entryRecord.args as unknown[]) : undefined;

	if (actualCommand === undefined || actualArgs === undefined) {
		return { status: "no-mcp-entry", rootPath: config.rootPath, connector: config.connector, hints };
	}

	// Step 8 — Drift comparison. Compute the expected entry from brain.aide
	// via interpolateArgs (substitutes ${rootPath} and ${entryFile} placeholders).
	// Compare command (string equality) and args (element-by-element string equality).
	// Comparison is structural — both sides are parsed in-memory objects, so whitespace
	// and key-ordering differences in the serialized .mcp.json are invisible to this check.
	const expectedCommand = config.mcpServerConfig.command;
	const expectedArgs = interpolateArgs(config);

	const commandMatches = actualCommand === expectedCommand;
	const argsMatch =
		actualArgs.length === expectedArgs.length &&
		expectedArgs.every((expectedArg, i) => actualArgs[i] === expectedArg);

	if (!commandMatches || !argsMatch) {
		return { status: "mcp-drift", rootPath: config.rootPath, connector: config.connector, hints };
	}

	// Step 9 — Happy path: brain.aide parsed, rootPath valid, .mcp.json brain entry
	// present and structurally matches the interpolated mcpServerConfig. No backend field.
	return { status: "ok", rootPath: config.rootPath, connector: config.connector, hints };
}
