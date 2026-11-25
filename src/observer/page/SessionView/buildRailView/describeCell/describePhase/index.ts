import type { Phase } from "@/types/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";
import describeFinished from "./describeFinished/index.js";
import describeRunning from "./describeRunning/index.js";
import describeSkipped from "./describeSkipped/index.js";

/** One phase of the rail as its stage reports: running, done, skipped (`todo`, `Skipped · <reason>`), or pending (`todo`, `Not started`). */
export default function describePhase({ phase, ctx }: { phase: Phase; ctx: RailContext }): RailCellDescription {
	const stage = ctx.stages.find((candidate) => candidate.phase === phase);
	if (stage?.state === "running") return describeRunning({ phase, entry: stage, ctx });
	if (stage?.state === "done") return describeFinished({ phase, ctx });
	if (stage?.state === "skipped") return describeSkipped({ stage });
	return { state: "todo", meta: NOT_STARTED, loop: null };
}
