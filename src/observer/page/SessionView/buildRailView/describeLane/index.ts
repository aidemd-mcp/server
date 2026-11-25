import type { Phase } from "@/types/index.js";
import type { LaneCell, RailContext } from "@/observer/page/types/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";
import describeSkipped from "@/observer/page/SessionView/buildRailView/describeCell/describePhase/describeSkipped/index.js";

/** One side lane from its stage: running is `Running`, done is `Done`, skipped is `Skipped · <reason>` in the not-started look, anything else `Not started`. */
export default function describeLane({ phase, ctx }: { phase: Phase; ctx: RailContext }): Pick<LaneCell, "state" | "meta" | "skipped"> {
	const stage = ctx.stages.find((candidate) => candidate.phase === phase);
	if (stage?.state === "running") return { state: "run", meta: "Running" };
	if (stage?.state === "done") return { state: "done", meta: "Done" };
	if (stage?.state === "skipped") return { state: "todo", meta: describeSkipped({ stage }).meta, skipped: true };
	return { state: "todo", meta: NOT_STARTED };
}
