import type { Phase } from "@/types/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import findPhaseDuration from "@/observer/page/SessionView/buildRailView/describeCell/shared/findPhaseDuration/index.js";
import findPlanSteps from "./findPlanSteps/index.js";

/**
 * A phase the rail reports finished: `Done <duration>` from its start and finish events of the
 * pipeline, or just `Done` when either was never reported. Build reads `Done <done> of <total>`
 * instead, from the plan's own numbered steps, falling back to its duration when the plan file is
 * gone.
 */
export default function describeFinished({ phase, ctx }: { phase: Phase; ctx: RailContext }): RailCellDescription {
	if (phase === "build") {
		const steps = findPlanSteps({ status: ctx.status, module: ctx.module });
		if (steps !== null) return { state: "done", meta: `Done ${steps.done} of ${steps.total}`, loop: null };
	}
	const duration = findPhaseDuration({ pipelineEvents: ctx.pipelineEvents, phase });
	return { state: "done", meta: duration === null ? "Done" : `Done ${duration}`, loop: null };
}
