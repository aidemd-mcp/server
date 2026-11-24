import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";
import findVerdicts from "@/observer/page/SessionView/buildRailView/describeCell/shared/findVerdicts/index.js";

/** The Done cell, which no phase names: `Done HH:MM` once the module's newest `qa_verdict` in the rail's session is `passed`, else not started. */
export default function describeDone({ ctx }: { ctx: RailContext }): RailCellDescription {
	const newest = findVerdicts({ moduleEvents: ctx.moduleEvents }).at(-1);
	if (newest?.verdict !== "passed") return { state: "todo", meta: NOT_STARTED, loop: null };
	return { state: "done", meta: `Done ${formatClock({ iso: newest.ts, now: ctx.now }).clock}`, loop: null };
}
