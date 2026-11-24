import type { Phase } from "@/types/index.js";
import type { LaneCell, RailContext } from "@/observer/page/types/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";

/** One side lane from the rail's report for its phase: running is `Running`, finished is `Done`, anything else `Not started`. */
export default function describeLane({ phase, ctx }: { phase: Phase; ctx: RailContext }): Pick<LaneCell, "state" | "meta"> {
	const entry = ctx.phases.find((candidate) => candidate.phase === phase);
	if (entry?.state === "running") return { state: "run", meta: "Running" };
	if (entry?.state === "done") return { state: "done", meta: "Done" };
	return { state: "todo", meta: NOT_STARTED };
}
