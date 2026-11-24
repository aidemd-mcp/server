import type { Phase, RailPhase } from "@/types/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import findElapsed from "./findElapsed/index.js";

/**
 * A phase the rail reports running. Build reads `Step <n> of <m>` once the plan's steps are known;
 * Fix reads `Round <r> · <elapsed>` and carries the `round <r>` loop badge; every other phase reads
 * `Running <elapsed>`. The elapsed part is left out, never guessed, when the status has no running
 * work to count from.
 */
export default function describeRunning({ phase, entry, ctx }: { phase: Phase; entry: RailPhase; ctx: RailContext }): RailCellDescription {
	if (phase === "build" && entry.buildStep) {
		return { state: "run", meta: `Step ${entry.buildStep.reached} of ${entry.buildStep.total}`, loop: null };
	}
	const elapsed = findElapsed({ phase, ctx });
	if (phase === "fix" && entry.qaFixRound !== undefined) {
		const round = `Round ${entry.qaFixRound}`;
		return { state: "run", meta: elapsed === null ? round : `${round} · ${elapsed}`, loop: `round ${entry.qaFixRound}` };
	}
	return { state: "run", meta: elapsed === null ? "Running" : `Running ${elapsed}`, loop: null };
}
