import type { BrainAideFault } from "@/types/index.js";

/**
 * Composes the `brain-aide-invalid` remediation sentence for `aide_brain` from
 * the detector's fault alone. A `missing-sections` fault names every absent
 * required section marker (in the order the parser reported them) and points
 * to the `aide_upgrade` brain-category insertion, then an `aide_info` re-check;
 * a `malformed` fault carries the parser's reason verbatim and points to a hand
 * fix with the user, then an `aide_info` re-check. Neither names
 * `/aide:brain config`. No other input is consulted — no section selector,
 * no brand, no file reads — so the output is identical for every `kind`.
 */
export default function composeOutdatedRemediation(fault: BrainAideFault): string {
	switch (fault.kind) {
		case "missing-sections":
			return `\`.aide/config/brain.aide\` is missing required sections: ${fault.sections.join(", ")}. With the user's consent, call \`aide_upgrade\` with \`category: "brain"\` — it inserts only the missing sections and leaves every existing section untouched — then re-check brain state with \`aide_info\`.`;
		case "malformed":
			return `\`.aide/config/brain.aide\` exists but is malformed: ${fault.reason}. Fix it by hand with the user at the place that reason names, then re-check brain state with \`aide_info\`. Do not proceed with this task as if the brain were available.`;
		default: {
			// Exhaustiveness guard — a new BrainAideFault kind fails to compile here.
			const _exhaustive: never = fault;
			void _exhaustive;
			throw new Error("Unhandled BrainAideFault kind");
		}
	}
}
