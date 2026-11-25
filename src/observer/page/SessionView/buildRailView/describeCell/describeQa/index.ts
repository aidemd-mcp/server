import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import describePhase from "@/observer/page/SessionView/buildRailView/describeCell/describePhase/index.js";
import findPhaseDuration from "@/observer/page/SessionView/buildRailView/describeCell/shared/findPhaseDuration/index.js";
import findVerdicts from "@/observer/page/SessionView/buildRailView/describeCell/shared/findVerdicts/index.js";

/**
 * The QA cell. While QA runs it reads as running, whatever an earlier round found. Otherwise the
 * pipeline's newest `qa_verdict` decides: `issues` is `fail` (`<open> issues · round <r>`, with the
 * count left out when the verdict did not report one; the round is the number of verdicts so far,
 * which is what the Fix beside it calls its round), `passed` is `done` (`Passed <duration>`).
 * Without a verdict the cell is whatever the rail reports for the phase.
 */
export default function describeQa({ ctx }: { ctx: RailContext }): RailCellDescription {
	const phase = describePhase({ phase: "qa", ctx });
	if (phase.state === "run") return phase;

	const verdicts = findVerdicts({ pipelineEvents: ctx.pipelineEvents });
	const newest = verdicts.at(-1);
	if (newest === undefined) return phase;
	if (newest.verdict === "passed") {
		const duration = findPhaseDuration({ pipelineEvents: ctx.pipelineEvents, phase: "qa" });
		return { state: "done", meta: duration === null ? "Passed" : `Passed ${duration}`, loop: null };
	}
	const issues = newest.open === undefined ? "issues" : `${newest.open} ${newest.open === 1 ? "issue" : "issues"}`;
	return { state: "fail", meta: `${issues} · round ${verdicts.length}`, loop: null };
}
