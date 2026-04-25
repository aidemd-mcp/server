import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import detectFramework from "@/tools/init/detectFramework/index.js";
import resolveBrainHints from "@/tools/init/resolveBrainHints/index.js";
import type { BrainHint, BrainState } from "@/types/index.js";

/**
 * Resolve the host project's obsidian brain-vault precondition state.
 *
 * Orchestrates a read-only detection pipeline and maps every failure mode to
 * a structured `BrainState` tagged union — never throws. Includes `hints`
 * (candidate vault locations from `resolveBrainHints`) on every returned
 * state so the orchestrator can offer remediation suggestions regardless of
 * which branch fires.
 *
 * Branch behaviour:
 *
 * 1. **MCP config read fails (ENOENT or any I/O error)** → `no-mcp-entry`.
 *    A missing config file is a normal pre-init state; the tool must not
 *    surface it as an exception.
 *
 * 2. **MCP config JSON is malformed** → `no-mcp-entry`.
 *    Mirrors `wireMcp`'s pattern: map parse failures to a structured state,
 *    never rethrow. The user's remediation is the same as "entry absent" —
 *    open Claude Code and run `/aide`; the orchestrator's inline-recovery flow
 *    detects the missing state and prompts for the vault path.
 *
 * 3. **`mcpServers` present but `"obsidian"` key absent** → `no-mcp-entry`.
 *    Single-key check on `"obsidian"` mirrors `provisionBrain.buildObsidianMcpStep`
 *    exactly — so "entry present" means the same thing on both sides (detection
 *    here, provisioning during init). Unlike the aide entry (which uses a
 *    dual-key check for a historical rename), obsidian has no second key. If
 *    a second obsidian key is ever added, update `provisionBrain` and this check
 *    together.
 *
 * 4. **Obsidian entry exists but the vault path is missing or unparseable:**
 *    - **`args` is missing, not an array, empty, or its last element is not a
 *      string** → `no-mcp-entry` with `vaultPath: null`. The entry shape is
 *      broken — no path can be extracted — and the remediation is identical to
 *      "entry absent": run `npx aidemd-mcp init` to provision a well-formed
 *      entry from scratch.
 *    - **Last element of `args` is an empty string** → `invalid-path` with
 *      `vaultPath: ""`. This is the deliberate cold-install state: the CLI
 *      writes an obsidian entry with an empty vault path so the user can
 *      finish setup via the `/aide` orchestrator's inline-recovery flow
 *      (`AskUserQuestion`). The entry shell is correctly shaped — the only
 *      thing missing is the vault path itself — so the orchestrator must be
 *      able to distinguish this from "entry absent" and fire the recovery
 *      branch rather than telling the user to re-run `npx aidemd-mcp init`.
 *
 * 5. **Vault path extracted (non-empty string); directory stat fails or
 *    target is not a dir** → `invalid-path` with `vaultPath` set to the
 *    configured path. Reserved for a correctly-shaped entry whose stored
 *    non-empty path does not resolve on disk (e.g. the user moved the vault
 *    folder). The configured path is forwarded so the orchestrator can name
 *    the exact failing path in its message.
 *
 * Happy path: entry present, args parseable, last positional arg is a
 * non-empty string, and the directory exists on disk → `ok` with `vaultPath`.
 *
 * Vault path extraction uses the last element of `args` — platform-agnostic.
 * POSIX shape: `["@bitbonsai/mcpvault", <vaultPath>]`. Windows shape:
 * `["/c", "npx", "@bitbonsai/mcpvault", <vaultPath>]`. The vault path is
 * always the final positional arg regardless of platform.
 */
export default async function buildBrainState(root: string): Promise<BrainState> {
	// Step 1 — resolve the framework-specific MCP config path.
	// Pass only `root` (no framework override) so detection defaults to
	// Claude Code on cold projects — inheriting the same "cold project"
	// semantics as wireMcp and provisionBrain.
	const frameworkConfig = await detectFramework(root);
	const mcpConfigPath = join(root, frameworkConfig.mcpConfigPath);

	// Step 2 — discover candidate vault locations for the orchestrator's
	// remediation flow. Independent read-only check — never throws.
	// Populated unconditionally so hints are available on every returned state.
	const hints: BrainHint[] = await resolveBrainHints(root);

	// Step 3 — read the MCP config file. ENOENT and all other read failures
	// collapse to no-mcp-entry: a missing config is a normal pre-init state.
	let raw: string;
	try {
		raw = await readFile(mcpConfigPath, "utf-8");
	} catch {
		return { status: "no-mcp-entry", vaultPath: null, hints };
	}

	// Step 4 — parse JSON. Malformed config maps to no-mcp-entry for the
	// same reason: the user's remediation is identical to "entry absent".
	let config: unknown;
	try {
		config = JSON.parse(raw);
	} catch {
		return { status: "no-mcp-entry", vaultPath: null, hints };
	}

	// Step 5 — check for the obsidian key in mcpServers.
	// Single-key check — mirrors provisionBrain.buildObsidianMcpStep exactly.
	// No historical rename exists for obsidian (unlike "aide"/"aidemd-mcp").
	const servers =
		config !== null && typeof config === "object" && "mcpServers" in config
			? ((config as Record<string, unknown>).mcpServers ?? {})
			: {};

	if (typeof servers !== "object" || servers === null || !("obsidian" in (servers as object))) {
		return { status: "no-mcp-entry", vaultPath: null, hints };
	}

	// Step 6 — extract the vault path from args.
	// Vault path is always the last positional element (platform-agnostic).
	// If args is missing, not an array, or empty → no-mcp-entry (entry shape
	// is broken; remediation is to re-run npx aidemd-mcp init).
	// If the last element is not a string → no-mcp-entry (same reasoning:
	// unrecoverable shape corruption, no path can be extracted).
	// If the last element is an empty string → invalid-path with vaultPath ""
	// (deliberate cold-install state: the CLI wrote the entry shell expecting
	// the orchestrator's inline-recovery flow to fill in the vault path).
	const obsidianEntry = (servers as Record<string, unknown>).obsidian;
	const args =
		obsidianEntry !== null &&
		typeof obsidianEntry === "object" &&
		"args" in (obsidianEntry as object)
			? (obsidianEntry as Record<string, unknown>).args
			: undefined;

	if (!Array.isArray(args) || args.length === 0) {
		return { status: "no-mcp-entry", vaultPath: null, hints };
	}

	const candidatePath = args[args.length - 1];
	if (typeof candidatePath !== "string") {
		return { status: "no-mcp-entry", vaultPath: null, hints };
	}
	if (candidatePath === "") {
		return { status: "invalid-path", vaultPath: "", hints };
	}

	// Step 7 — stat the non-empty candidate vault path.
	// Resolves to an existing directory → ok. Fails or not a directory → invalid-path.
	// Only reached when candidatePath is a non-empty string (empty-string
	// was already returned as invalid-path above). The configured path is
	// always carried forward in invalid-path so the orchestrator can surface
	// the exact failing path to the user.
	try {
		const info = await stat(candidatePath);
		if (!info.isDirectory()) {
			return { status: "invalid-path", vaultPath: candidatePath, hints };
		}
	} catch {
		return { status: "invalid-path", vaultPath: candidatePath, hints };
	}

	return { status: "ok", vaultPath: candidatePath, hints };
}
