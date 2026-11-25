import type { RailPhase } from "@/types/index.js";
import type { RailCellDescription } from "@/observer/page/types/index.js";

/**
 * A stage a skip report closed: the not-started look (`todo`, since `viewer.css` has no skipped style)
 * with the word `Skipped · <reason>` carrying the state; a stage with no reason reads plain `Skipped`.
 */
export default function describeSkipped({ stage }: { stage: RailPhase }): RailCellDescription {
	return { state: "todo", meta: stage.reason === undefined ? "Skipped" : `Skipped · ${stage.reason}`, loop: null, skipped: true };
}
