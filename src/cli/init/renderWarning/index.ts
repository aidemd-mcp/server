import type { InstallResult } from "../types/index.js";

const BORDER = "=".repeat(60);

/**
 * Renders the post-install warning block shown after the per-file log.
 *
 * **Pure function** — no I/O, no side effects, deterministic output for
 * identical inputs.
 *
 * **Suppression rule (load-bearing):** if
 * `skipped.length + failed.length + deferredCategories.length === 0`,
 * returns the empty string. The caller (`runInit`) treats an empty return
 * as "suppress the warning block; print the plain completion line instead."
 * An empty warning block over a clean install is the exact undesired outcome
 * the spec forbids.
 *
 * **Skipped-files subsection** appears only when
 * `skipped.length + failed.length > 0`. Skipped (`exists`) and failed
 * entries are merged into a single numbered list because both represent
 * "things not in their canonical state" — the user-facing contract is a
 * unified action list, not an error-class split.
 *
 * **Deferred-categories subsection** appears only when
 * `deferredCategories.length > 0`. Each string in `deferredCategories` is
 * self-contained guidance that names its own follow-up surface inline —
 * Brain wiring (combined brain.aide + MCP entry) routes to `/aide`
 * (orchestrator inline-recovery), IDE routes to a CLI re-run with `--ide`.
 * The renderer numbers the entries and prints them verbatim; it does NOT
 * append a single "Next step" footer, because there is no one command that
 * handles all categories.
 *
 * **Heavy `=` borders and uppercase heading are load-bearing** per strategy:
 * the per-file log uses bare `[created]`/`[exists]` prefixes with no
 * decoration, so the warning must break that visual rhythm to register as
 * distinct. Do NOT substitute the light box-drawing characters (`─`/`│`).
 */
export default function renderWarning(input: {
    skipped: readonly InstallResult[];
    failed: readonly InstallResult[];
    deferredCategories: readonly string[];
}): string {
    const { skipped, failed, deferredCategories } = input;

    if (skipped.length + failed.length + deferredCategories.length === 0) {
        return "";
    }

    const lines: string[] = [];

    lines.push("");
    lines.push(BORDER);
    lines.push("  SETUP INCOMPLETE — ACTION REQUIRED");
    lines.push(BORDER);
    lines.push("");

    if (skipped.length + failed.length > 0) {
        lines.push("  Skipped files (already on disk or write failed — not overwritten):");
        const combined = [...skipped, ...failed];
        for (let i = 0; i < combined.length; i++) {
            const entry = combined[i];
            lines.push(`    ${i + 1}. ${entry.displayPath} — ${entry.message}`);
        }
        lines.push("");
    }

    if (deferredCategories.length > 0) {
        lines.push("  Deferred (each item names how to finish it):");
        for (let i = 0; i < deferredCategories.length; i++) {
            lines.push(`    ${i + 1}. ${deferredCategories[i]}`);
        }
        lines.push("");
    }

    lines.push(BORDER);

    return lines.join("\n");
}
