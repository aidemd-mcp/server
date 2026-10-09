import type { BrainAideFault } from "@/types/index.js";

/**
 * Composes the `brain-aide-invalid` remediation sentence for `aide_brain` from
 * the detector's fault alone. A `missing-sections` fault names every absent
 * required section marker (in the order the parser reported them); a
 * `malformed` fault carries the parser's reason verbatim. Both route the user
 * to `/aide:brain config`. No other input is consulted — no section selector,
 * no brand, no file reads — so the output is identical for every `kind`.
 */
export default function composeOutdatedRemediation(fault: BrainAideFault): string {
	switch (fault.kind) {
		case "missing-sections":
			return `\`.aide/config/brain.aide\` is missing required sections: ${fault.sections.join(", ")}. Tell the user to run \`/aide:brain config\` — it adds only the missing sections from the latest bundled template and leaves every existing section untouched. Do not proceed with this task as if the brain were available.`;
		case "malformed":
			return `\`.aide/config/brain.aide\` exists but is malformed: ${fault.reason}. Tell the user to run \`/aide:brain config\` to repair it. Do not proceed with this task as if the brain were available.`;
		default: {
			// Exhaustiveness guard — a new BrainAideFault kind fails to compile here.
			const _exhaustive: never = fault;
			void _exhaustive;
			throw new Error("Unhandled BrainAideFault kind");
		}
	}
}
