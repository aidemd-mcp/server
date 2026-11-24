import type { Phase } from "@/types/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";
import describeFinished from "./describeFinished/index.js";
import describeRunning from "./describeRunning/index.js";

/** One phase of the rail as the observer's rail reports it: running, finished, or not run (`todo`, `Not started`). */
export default function describePhase({ phase, ctx }: { phase: Phase; ctx: RailContext }): RailCellDescription {
	const entry = ctx.phases.find((candidate) => candidate.phase === phase);
	if (entry?.state === "running") return describeRunning({ phase, entry, ctx });
	if (entry?.state === "done") return describeFinished({ phase, ctx });
	return { state: "todo", meta: NOT_STARTED, loop: null };
}
