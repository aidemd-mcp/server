import { z } from "zod";
import buildBrainState from "@/service/buildBrainState/index.js";
import classifyParseFailure from "@/service/buildBrainState/classifyParseFailure/index.js";
import brainContract from "@/service/brainContract/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker, BrainToolResult } from "@/types/index.js";
import composeOutdatedRemediation from "./composeOutdatedRemediation/index.js";
import sectionPurpose from "./sectionPurpose/index.js";
import selectSection from "./selectSection/index.js";

// Remediation prose for an absent file. The `brain-aide-invalid` sentence is
// composed from the detector's fault by composeOutdatedRemediation. These
// strings are the load-bearing surface: agents surface them to the user
// verbatim, so they must name a specific terminal command or user action.

const NO_BRAIN_AIDE_PROSE =
	"No `.aide/config/brain.aide` is present in this project. Tell the user to run `/aide:brain config` — it asks which brain backend they use and creates the config. Do not proceed with this task as if the brain were available — the file must exist before brain-dependent work continues.";

/**
 * Input schema for `aide_brain`. Accepts an optional `kind` field whose
 * vocabulary is every section marker of the published `brainContract`, derived
 * from it rather than hand-typed. Unknown values are rejected at the schema
 * boundary — the handler never sees them. The handler resolves the default
 * (`"orientation"`) after parsing, so an absent `kind` field remains absent
 * (not coerced) at the schema level.
 */
export const BrainInput = z.object({
	kind: z.enum(brainContract.map(({ marker }) => marker) as [BrainSectionMarker, ...BrainSectionMarker[]]).optional(),
});

/**
 * Runtime brain entry-point tool. Called **on demand** — when an agent needs
 * the brain mid-task. Must NOT be called from `aide_info` and must NOT be fired
 * automatically on `/aide` boot. Boot-time brain state is already surfaced by
 * `aide_info.brain`; firing this tool unconditionally at boot duplicates that
 * work.
 *
 * The optional `kind` parameter names any `brainContract` section marker
 * (default `"orientation"`) and selects that one section of `brain.aide`.
 *
 * Response contract:
 * - On every status where the file exists and is well-formed (`ok`,
 *   `missing-sections`, `no-mcp-entry`, `mcp-drift`) the requested section is
 *   returned verbatim in `instructions` and `found` is `true`: the bytes the
 *   user wrote between that section's markers, with no trimming,
 *   normalization, or `${...}` substitution. `status` is the detector's state
 *   even when a section is returned.
 * - `found` says whether `instructions` is the requested section. It is set
 *   from the branch taken, never from `status`.
 * - `purpose` is the requested section's one-line purpose from the published
 *   `brainContract`, never from the user's `brain.aide`. It is present only
 *   when `found` is `true` and absent (not `undefined`-valued) on every
 *   remediation branch.
 * - `instructions` is a remediation sentence (`found: false`) only for an
 *   absent file, a malformed or unreadable file, or a requested section that
 *   is missing from an otherwise readable file. A missing section is
 *   remediated by `aide_upgrade` with `category: "brain"`; a malformed file by
 *   a hand fix and an `aide_info` re-check.
 * - `instructions` is never empty on any branch.
 * - No `backend`, `name`, `connector`, or `kind` field on any branch —
 *   consumers branch on `status` and `found`.
 * - Read-only; at most one state check and one parse per call.
 * - Never throws on input it was given — all failure modes return a structured
 *   `BrainToolResult`.
 */
export default async function brain(root: string, input?: { kind?: BrainSectionMarker }): Promise<BrainToolResult> {
	// Step 1 — Resolve the effective kind before any I/O.
	const kind: BrainSectionMarker = input?.kind ?? "orientation";

	// Step 2 — Resolve brain precondition state; the detector never throws.
	const state = await buildBrainState(root);

	// Step 3 — Absent file: remediation only, nothing to parse.
	if (state.status === "no-brain-aide") {
		return { status: state.status, instructions: NO_BRAIN_AIDE_PROSE, found: false };
	}

	// Step 4 — Malformed or unreadable file: no section can be trusted, so
	// remediation only, nothing to parse.
	if (state.status === "brain-aide-invalid" && state.fault.kind === "malformed") {
		return { status: state.status, instructions: composeOutdatedRemediation(state.fault), found: false };
	}

	// Step 5 — The one parse of this call.
	const parse = await parseBrainAide(root);

	// Step 6 — The requested section is present: return it verbatim with its
	// contract purpose and the detector's status unchanged.
	const section = selectSection({ parse, marker: kind });
	if (section !== undefined) {
		return { status: state.status, instructions: section, found: true, purpose: sectionPurpose(kind) };
	}

	// Step 7 — The parse is non-ok (an `ok` parse always carries the section).
	// One branch serves both "requested section missing" and the detector and
	// parser disagreeing. classifyParseFailure is the single mapping from a
	// parse failure to a fault: `null` means the file is genuinely absent; a
	// fault means it is present but missing sections or malformed, and the
	// remediation is composed only from that fault.
	if (parse.kind === "ok") {
		// Exhaustiveness guard — unreachable: an `ok` parse carries every contract
		// field, so selectSection returned a string above.
		throw new Error(`ok parse carried no section for marker "${kind}"`);
	}
	const fault = classifyParseFailure(parse);
	if (fault === null) return { status: "no-brain-aide", instructions: NO_BRAIN_AIDE_PROSE, found: false };
	return { status: "brain-aide-invalid", instructions: composeOutdatedRemediation(fault), found: false };
}
