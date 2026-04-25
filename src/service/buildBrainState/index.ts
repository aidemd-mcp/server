import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import resolveBackend from "@/service/brainBackends/index.js";
import type { BrainHint, BrainState, McpServerEntry } from "@/types/index.js";

/**
 * Resolve the host project's brain-vault precondition state.
 *
 * Orchestrates a read-only detection pipeline and maps every failure mode to
 * a structured `BrainState` tagged union — never throws. Includes `hints`
 * (candidate vault locations from `resolveBrainHints`) on every returned
 * state so the orchestrator can offer remediation suggestions regardless of
 * which branch fires.
 *
 * The fixed `"brain"` MCP key is the sole lookup target. There is no `obsidian`
 * fallback — legacy migration is the install service's job (one-shot at upgrade
 * time). Backend identity comes from `resolveBackend`, never from the key name.
 *
 * Branch behaviour:
 *
 * 1. **MCP config read fails (ENOENT or any I/O error)** → `no-mcp-entry`,
 *    `vaultPath: null`, `backend: null`. A missing config file is a normal
 *    pre-init state; the function must not surface it as an exception.
 *
 * 2. **MCP config JSON is malformed** → `no-mcp-entry`, `vaultPath: null`,
 *    `backend: null`. Map parse failures to a structured state, never rethrow.
 *    Remediation is identical to "entry absent".
 *
 * 3. **`mcpServers` present but `"brain"` key absent** → `no-mcp-entry`,
 *    `vaultPath: null`, `backend: null`. Single fixed-key check — no obsidian
 *    fallback. If a legacy `obsidian` key is present, the install service's
 *    migration step is the correct fix, not a runtime fallback here.
 *
 * 4. **Brain entry exists but the vault path is missing or unparseable:**
 *    - **`args` is missing, not an array, empty, or its last element is not a
 *      string** → `no-mcp-entry`, `vaultPath: null`, `backend: null`. Entry
 *      shape is broken — remediation is to re-run `npx aidemd-mcp init`.
 *    - **Last element of `args` is an empty string** → `invalid-path`,
 *      `vaultPath: ""`, `backend: null`. Deliberate cold-install state written
 *      by `provisionBrain` so the orchestrator's inline-recovery flow can
 *      distinguish "entry absent" from "entry present, path not yet filled".
 *
 * 5. **Entry present and vault path non-empty, but the registry does not
 *    recognise the command/args shape** → `no-mcp-entry`, `vaultPath: null`,
 *    `backend: null`. The wired-but-unrecognised case collapses to the same
 *    shape as "never wired at all" — same remediation, no new vocabulary.
 *
 * 6. **Vault path extracted (non-empty string); directory stat fails or
 *    target is not a dir** → `invalid-path`, `vaultPath: candidatePath`,
 *    `backend: null`. The configured path is forwarded so the orchestrator
 *    can name the exact failing path in its message.
 *
 * 7. **Happy path** — entry present, args parseable, vault path is a non-empty
 *    string, registry recognises the entry, directory exists on disk → `ok`,
 *    `vaultPath: candidatePath`, `backend: driver.id`.
 *
 * Discriminant invariants (enforced by branch return literals):
 * - `status: "ok"` ⇒ `vaultPath: string` AND `backend: string`.
 * - `status: "no-mcp-entry"` ⇒ `vaultPath: null` AND `backend: null`.
 * - `status: "invalid-path"` ⇒ `vaultPath: string` AND `backend: null`.
 *
 * Vault path extraction uses the last element of `args` — platform-agnostic.
 * POSIX shape: `["@bitbonsai/mcpvault", <vaultPath>]`. Windows shape:
 * `["/c", "npx", "@bitbonsai/mcpvault", <vaultPath>]`. The vault path is
 * always the final positional arg regardless of platform.
 */
export default async function buildBrainState(root: string): Promise<BrainState> {
	// Step 1 — resolve the framework-specific MCP config path.
	// Pass only `root` (no framework override) so detection defaults to
	// Claude Code on cold projects — same semantics as wireMcp and provisionBrain.
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
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}

	// Step 4 — parse JSON. Malformed config maps to no-mcp-entry for the
	// same reason: remediation is identical to "entry absent".
	let config: unknown;
	try {
		config = JSON.parse(raw);
	} catch {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}

	// Step 5 — check for the fixed "brain" key in mcpServers.
	// The "in" operator distinguishes "key absent" from "key present but null/undefined".
	// No obsidian fallback — legacy migration is the install service's job.
	const servers =
		config !== null && typeof config === "object" && "mcpServers" in config
			? ((config as Record<string, unknown>).mcpServers ?? {})
			: {};

	if (typeof servers !== "object" || servers === null || !("brain" in (servers as object))) {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
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
	const brainEntry = (servers as Record<string, unknown>).brain;
	const args =
		brainEntry !== null &&
		typeof brainEntry === "object" &&
		"args" in (brainEntry as object)
			? (brainEntry as Record<string, unknown>).args
			: undefined;

	if (!Array.isArray(args) || args.length === 0) {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}

	const candidatePath = args[args.length - 1];
	if (typeof candidatePath !== "string") {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}
	if (candidatePath === "") {
		return { status: "invalid-path", vaultPath: "", backend: null, hints };
	}

	// Step 7 — defensive narrowing of command before constructing the McpServerEntry.
	// The brain entry is unknown until validated; command must be a string per
	// McpServerEntry's contract. If it is missing or non-string, the entry shape
	// is corrupt — collapse to no-mcp-entry (same as malformed args).
	const rawCommand =
		brainEntry !== null &&
		typeof brainEntry === "object" &&
		"command" in (brainEntry as object)
			? (brainEntry as Record<string, unknown>).command
			: undefined;

	if (typeof rawCommand !== "string") {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}

	// Step 8 — registry dispatch. Build a typed McpServerEntry and delegate
	// backend recognition to resolveBackend. Never inspect command/args here
	// to derive identity — that is the registry's job. If the registry returns
	// null (wired-but-unrecognised backend), collapse to no-mcp-entry: same
	// remediation as "never wired at all", no new status vocabulary.
	const entry: McpServerEntry = { command: rawCommand, args: args as string[] };
	const driver = resolveBackend(entry);
	if (driver === null) {
		return { status: "no-mcp-entry", vaultPath: null, backend: null, hints };
	}

	// Step 9 — stat the non-empty candidate vault path.
	// Resolves to an existing directory → ok. Fails or not a directory → invalid-path.
	// The configured path is always carried forward in invalid-path so the
	// orchestrator can surface the exact failing path to the user.
	try {
		const info = await stat(candidatePath);
		if (!info.isDirectory()) {
			return { status: "invalid-path", vaultPath: candidatePath, backend: null, hints };
		}
	} catch {
		return { status: "invalid-path", vaultPath: candidatePath, backend: null, hints };
	}

	// Step 10 — happy path: entry present, args parseable, vault path non-empty,
	// registry recognised the backend, directory exists on disk. Store driver.id
	// (a plain string), never the driver object itself.
	return { status: "ok", vaultPath: candidatePath, backend: driver.id, hints };
}
