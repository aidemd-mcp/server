import { z } from "zod";
import buildBrainState from "@/service/buildBrainState/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import type { BrainToolResult } from "@/types/index.js";

// Non-ok remediation prose — one fixed sentence per failure state.
// These strings are the load-bearing surface: agents surface them to the user
// verbatim, so they must name a specific terminal command or user action.

const NO_BRAIN_AIDE_PROSE =
	"No `.aide/config/brain.aide` is present in this project. Tell the user to run `npx @aidemd-mcp/server@latest init` to scaffold the brain config file, or `/aide:brain config` if they want to be walked through it. Do not proceed with this task as if the brain were available — the file must exist before brain-dependent work continues.";

const NO_MCP_ENTRY_PROSE =
	"A brain config exists at `.aide/config/brain.aide`, but no `brain` MCP entry is wired in `.mcp.json`. Tell the user to run `npx @aidemd-mcp/server@latest sync` to apply the config to `.mcp.json`, then restart Claude Code. Do not proceed with this task as if the brain were available.";

const MCP_DRIFT_PROSE =
	"`.aide/config/brain.aide` and `.mcp.json` disagree about the brain entry. Tell the user to run `npx @aidemd-mcp/server@latest sync` in their terminal — that is the only command that mutates `.mcp.json` from `brain.aide`. Then restart Claude Code. Do not attempt to patch `.mcp.json` from this session.";

/** The two accepted values for the `kind` parameter. */
type BrainKind = "orientation" | "config";

/**
 * Input schema for `aide_brain`. Accepts an optional `kind` field whose
 * vocabulary is closed to `"orientation"` and `"config"`. Unknown values are
 * rejected at the schema boundary — the handler never sees them. The handler
 * resolves the default (`"orientation"`) after parsing, so an absent `kind`
 * field remains absent (not coerced) at the schema level.
 */
export const BrainInput = z.object({
	kind: z.enum(["orientation", "config"]).optional(),
});

/**
 * Runtime brain entry-point tool. Called **on demand** — when an agent needs
 * the brain mid-task. Must NOT be called from `aide_info` and must NOT be fired
 * automatically on `/aide` boot. Boot-time brain state is already surfaced by
 * `aide_info.brain`; firing this tool unconditionally at boot duplicates that
 * work.
 *
 * The optional `kind` parameter selects which section of `brain.aide` to return:
 * - `"orientation"` (default) — the orientation section, a runtime briefing
 *   delivered when an agent reaches for the brain mid-task.
 * - `"config"` — the integration-specific wiring flow, used by `/aide:brain config`.
 *
 * Install-time seed sections (`playbookIndex`, `studyPlaybook`, `updatePlaybook`,
 * `researchIndex`) are NOT surfaced via this tool — agents reach those via the
 * brain's read tool against the on-disk seed files.
 *
 * Response contract:
 * - On `status: "ok"`, `instructions` is the verbatim bytes of the selected
 *   section from `.aide/config/brain.aide`, byte-identical to what the user
 *   wrote between that section's markers. No trimming, no normalization, no
 *   `${...}` substitution of any kind.
 * - On every non-ok `BrainState` status, `instructions` is a fixed
 *   backend-agnostic remediation sentence. The remediation is identical
 *   regardless of `kind` — non-ok branches fire before any section is read.
 * - `instructions` is never empty on any branch.
 * - No `backend`, `name`, `connector`, or `kind` field on any branch —
 *   consumers branch on `status` alone.
 * - Never throws — all failure modes return a structured `BrainToolResult`.
 */
export default async function brain(root: string, input?: { kind?: BrainKind }): Promise<BrainToolResult> {
	// Resolve the effective kind once, before any I/O, so the resolved value
	// is available for the `ok` branch. Non-ok branches do not consume it.
	const kind: BrainKind = input?.kind ?? "orientation";

	// Step 1 — Resolve brain precondition state. The returned status drives
	// all downstream branching; the detector never throws.
	const state = await buildBrainState(root);

	// Step 2 — Branch on state.status. Each non-ok branch returns immediately
	// with a fixed remediation sentence; only `ok` falls through to Step 3.
	// Remediation prose is identical regardless of `kind` — the file is broken
	// for all sections in the same way.
	if (state.status === "no-brain-aide") {
		return { status: state.status, instructions: NO_BRAIN_AIDE_PROSE };
	}

	if (state.status === "no-mcp-entry") {
		return { status: state.status, instructions: NO_MCP_ENTRY_PROSE };
	}

	if (state.status === "mcp-drift") {
		return { status: state.status, instructions: MCP_DRIFT_PROSE };
	}

	// Step 3 — `ok` branch: retrieve the selected section via parseBrainAide.
	// buildBrainState already validated the file is parseable, so this call should
	// always return `kind: "ok"`. The selected section is returned byte-identical —
	// no substitution, no trimming, no transformation of any kind.
	const parseResult = await parseBrainAide(root);

	if (parseResult.kind === "ok") {
		switch (kind) {
			case "orientation":
				return { status: "ok", instructions: parseResult.orientation };
			case "config":
				return { status: "ok", instructions: parseResult.config };
			default: {
				// Exhaustiveness guard — if BrainKind gains a new value, this
				// branch fails to compile until a matching case is added above.
				const _exhaustive: never = kind;
				void _exhaustive;
				// Fall through to the defensive fallback below.
			}
		}
	}

	// Step 4 — Defensive fallback: parseBrainAide returned a non-ok kind despite
	// buildBrainState reporting `ok`. This should be impossible (a race between
	// file deletion and the two calls, or a future refactor that relaxes
	// buildBrainState's validation). The upstream-contract-violation pattern here
	// is a missing-or-broken-file shape — the selected section could not be read —
	// so NO_BRAIN_AIDE_PROSE is the natural remediation: it directs the user to
	// run init, which scaffolds the file.
	return { status: "no-brain-aide", instructions: NO_BRAIN_AIDE_PROSE };
}
