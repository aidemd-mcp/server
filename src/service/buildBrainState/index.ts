import { readFile } from "node:fs/promises";
import { join } from "node:path";
import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import parseBrainAide, { interpolateArgs } from "@/service/parseBrainAide/index.js";
import type { BrainHint, BrainState } from "@/types/index.js";

/**
 * Resolve the host project's brain precondition state into a four-state
 * tagged union. Never throws — every failure mode collapses to a structured
 * `BrainState` value with targeted remediation vocabulary.
 *
 * The detection pipeline, in order:
 *
 * 1. **Resolve framework config** via `detectFramework(root)`. Compute
 *    `mcpConfigPath` from `frameworkConfig.mcpConfigPath`. Unchanged from the
 *    prior pipeline.
 *
 * 2. **Resolve hints** via `resolveBrainHints(root)`. Populated unconditionally
 *    so `hints` appears on every returned state regardless of which branch fires.
 *
 * 3. **Parse `brain.aide`** via `parseBrainAide(root)`. Any non-`ok` result
 *    (`missing`, `malformed-frontmatter`, `malformed-body`) → `no-brain-aide`.
 *    All three sub-cases collapse to the same status — remediation is identical
 *    ("fix or create the file") and `no-brain-aide` carries no `name` because
 *    there is nothing readable to label.
 *
 * 4. **Read `.mcp.json`** at `mcpConfigPath` via `readFile`. ENOENT or any I/O
 *    failure → `no-mcp-entry`. Carries `config.name` so the orchestrator can
 *    name the wired brain in remediation prose.
 *
 * 5. **Parse `.mcp.json` JSON**. Parse failure → `no-mcp-entry`. Same
 *    remediation as I/O failure.
 *
 * 6. **Look up `mcpServers.brain`**. Any structural miss — `mcpServers` absent
 *    or not an object, `brain` key absent, `brain` value not an object, `command`
 *    not a string, `args` not an array → `no-mcp-entry`. NO fallback to any
 *    legacy key under any circumstance.
 *
 * 7. **Compute the expected entry** from the parsed brain.aide:
 *    `expectedCommand = config.mcpServerConfig.command`,
 *    `expectedArgs = interpolateArgs(config)`. The `interpolateArgs` call is
 *    unconditional — in the default scaffold (no placeholders) it returns args
 *    unchanged; advanced users who use `${name}` rely on the call running.
 *
 * 8. **Structural drift comparison** — `command` (string equality), `args`
 *    (length then element-by-element string equality). Both sides are in-memory
 *    objects so whitespace and key ordering in the serialized `.mcp.json` are
 *    invisible to this check. Either mismatch → `mcp-drift`.
 *
 * 9. **Happy path** — everything agrees → `ok`.
 *
 * Hard invariants:
 * - The detector NEVER throws. Every failure mode collapses to a structured BrainState.
 * - The detector NEVER stats any path. No `stat`, `existsSync`, or `lstat`.
 * - The detector NEVER imports from any retired backend registry.
 * - The detector NEVER branches on `config.name` or any value derived from it.
 * - The detector NEVER auto-syncs `.mcp.json` on drift. No writes from this module.
 * - The detector NEVER falls back to a legacy `mcpServers.obsidian` key.
 * - The detector NEVER introspects `mcpServerConfig.args` beyond element-by-element equality.
 * - Pipeline order is fixed: brain.aide first, then `.mcp.json`. Inverting the order
 *   would invert the source-of-truth direction.
 */
export default async function buildBrainState(root: string): Promise<BrainState> {
	// Step 1 — Resolve the framework-specific MCP config path.
	// Pass only `root` so detection defaults to Claude Code on cold projects.
	const frameworkConfig = await detectFramework(root);
	const mcpConfigPath = join(root, frameworkConfig.mcpConfigPath);

	// Step 2 — Discover candidate brain root locations for remediation suggestions.
	// Populated unconditionally so hints appear on every returned state regardless
	// of which branch fires.
	const hints: BrainHint[] = await resolveBrainHints(root);

	// Step 3 — Parse brain.aide. All non-ok parse results collapse to no-brain-aide.
	// The parser owns the format contract; the detector only branches on `kind`.
	// All three failure sub-cases (missing, malformed-frontmatter, malformed-body)
	// map to the same remediation: fix or create the file.
	const parseResult = await parseBrainAide(root);
	if (parseResult.kind !== "ok") {
		return { status: "no-brain-aide", hints };
	}
	const { name, mcpServerConfig } = parseResult;

	// Step 4 — Read .mcp.json at the framework-derived path. ENOENT and all
	// other I/O failures collapse to no-mcp-entry: the user has a brain.aide but
	// no .mcp.json yet — remediation is to run `npx aidemd-mcp sync`.
	let raw: string;
	try {
		raw = await readFile(mcpConfigPath, "utf-8");
	} catch {
		return { status: "no-mcp-entry", name, hints };
	}

	// Step 5 — Parse .mcp.json JSON. Parse failure maps to no-mcp-entry for
	// the same reason: remediation is identical to "entry absent".
	let mcpConfig: unknown;
	try {
		mcpConfig = JSON.parse(raw);
	} catch {
		return { status: "no-mcp-entry", name, hints };
	}

	// Step 6 — Look up mcpServers.brain. Any structural miss → no-mcp-entry.
	// No fallback to any legacy key — the fixed "brain" key is settled at install.
	const servers =
		mcpConfig !== null && typeof mcpConfig === "object" && "mcpServers" in mcpConfig
			? (mcpConfig as Record<string, unknown>).mcpServers
			: undefined;

	if (servers === null || typeof servers !== "object" || !("brain" in (servers as object))) {
		return { status: "no-mcp-entry", name, hints };
	}

	const brainEntry = (servers as Record<string, unknown>).brain;

	if (brainEntry === null || typeof brainEntry !== "object") {
		return { status: "no-mcp-entry", name, hints };
	}

	const entryRecord = brainEntry as Record<string, unknown>;
	const actualCommand = typeof entryRecord.command === "string" ? entryRecord.command : undefined;
	const actualArgs = Array.isArray(entryRecord.args) ? (entryRecord.args as unknown[]) : undefined;

	if (actualCommand === undefined || actualArgs === undefined) {
		return { status: "no-mcp-entry", name, hints };
	}

	// Step 7 — Compute the expected entry from the parsed brain.aide.
	// interpolateArgs is called unconditionally per the spec's "always interpolate,
	// then compare" contract — a no-op for default installs (no placeholders), but
	// required for advanced users who use ${name} in their args.
	const expectedCommand = mcpServerConfig.command;
	const expectedArgs = interpolateArgs({ name, mcpServerConfig });

	// Step 8 — Structural drift comparison. Both sides are in-memory objects so
	// whitespace and key ordering in the serialized .mcp.json are invisible to
	// this check.
	const commandMatches = actualCommand === expectedCommand;
	const argsMatch =
		actualArgs.length === expectedArgs.length &&
		expectedArgs.every((expected, i) => actualArgs[i] === expected);

	if (!commandMatches || !argsMatch) {
		return { status: "mcp-drift", name, hints };
	}

	// Step 9 — Happy path: brain.aide parsed, .mcp.json brain entry present and
	// structurally matches the interpolated mcpServerConfig.
	return { status: "ok", name, hints };
}
