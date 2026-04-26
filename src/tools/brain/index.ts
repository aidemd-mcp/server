import { z } from "zod";
import buildBrainState from "@/service/buildBrainState/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import type { BrainToolResult } from "@/types/index.js";

// Non-ok remediation prose — one fixed sentence per failure state.
// These strings are the load-bearing surface: agents surface them to the user
// verbatim, so they must name a specific terminal command or user action.

const NO_BRAIN_AIDE_PROSE =
	"No `.aide/brain.aide` is present in this project. Tell the user to run `npx aidemd-mcp init` to scaffold the brain config file, or `/aide:brain config` if they want to be walked through it. Do not proceed with this task as if the brain were available — the file must exist before brain-dependent work continues.";

const NO_MCP_ENTRY_PROSE =
	"A brain config exists at `.aide/brain.aide`, but no `brain` MCP entry is wired in `.mcp.json`. Tell the user to run `npx aidemd-mcp sync` to apply the config to `.mcp.json`, then restart Claude Code. Do not proceed with this task as if the brain were available.";

const INVALID_PATH_PROSE =
	"The `rootPath` declared in `.aide/brain.aide` does not resolve on disk. Tell the user which path is broken (it appears in the boot reporter's diagnostic) and ask them to either correct `rootPath` or create the directory. Do not proceed with this task as if the brain were available.";

const MCP_DRIFT_PROSE =
	"`.aide/brain.aide` and `.mcp.json` disagree about the brain entry. Tell the user to run `npx aidemd-mcp sync` in their terminal — that is the only command that mutates `.mcp.json` from `brain.aide`. Then restart Claude Code. Do not attempt to patch `.mcp.json` from this session.";

/**
 * Input schema for `aide_brain`. No parameters — the tool always uses the
 * server's working directory, mirroring `aide_info`'s pattern.
 */
export const BrainInput = z.object({});

/**
 * Runtime brain entry-point tool. Called **on demand** — when an agent needs
 * the brain mid-task. Must NOT be called from `aide_info` and must NOT be fired
 * automatically on `/aide` boot. Boot-time brain state is already surfaced by
 * `aide_info.brain`; firing this tool unconditionally at boot duplicates that
 * work.
 *
 * Response contract:
 * - On `status: "ok"`, `instructions` is the verbatim `## Prose` body from
 *   `.aide/brain.aide`, byte-identical to what the user wrote. No trimming, no
 *   normalization, no `${...}` substitution of any kind.
 * - On every non-ok status, `instructions` is a fixed backend-agnostic
 *   remediation sentence directing the user to a specific terminal command or
 *   file edit. `instructions` is never empty on any branch.
 * - No `backend` field on any branch — consumers branch on `status` alone.
 * - Never throws — all failure modes return a structured `BrainToolResult`.
 */
export default async function brain(root: string): Promise<BrainToolResult> {
	// Step 1 — Resolve brain precondition state. The returned status drives
	// all downstream branching; the detector never throws.
	const state = await buildBrainState(root);

	// Step 2 — Branch on state.status. Each non-ok branch returns immediately
	// with a fixed remediation sentence; only `ok` falls through to Step 3.
	if (state.status === "no-brain-aide") {
		return { status: state.status, instructions: NO_BRAIN_AIDE_PROSE };
	}

	if (state.status === "no-mcp-entry") {
		return { status: state.status, instructions: NO_MCP_ENTRY_PROSE };
	}

	if (state.status === "invalid-path") {
		return { status: state.status, instructions: INVALID_PATH_PROSE };
	}

	if (state.status === "mcp-drift") {
		return { status: state.status, instructions: MCP_DRIFT_PROSE };
	}

	// Step 3 — `ok` branch: retrieve the verbatim prose body via parseBrainAide.
	// buildBrainState already validated the file is parseable, so this call should
	// always return `kind: "ok"`. The prose is returned byte-identical — no
	// substitution, no trimming, no transformation of any kind.
	const parseResult = await parseBrainAide(root);

	if (parseResult.kind === "ok") {
		return { status: "ok", instructions: parseResult.prose };
	}

	// Step 4 — Defensive fallback: parseBrainAide returned a non-ok kind despite
	// buildBrainState reporting `ok`. This should be impossible (a race between
	// file deletion and the two calls, or a future refactor that relaxes
	// buildBrainState's validation). Fall through to INVALID_PATH_PROSE to satisfy
	// the "instructions never empty" invariant rather than returning an empty string.
	return { status: "invalid-path", instructions: INVALID_PATH_PROSE };
}
