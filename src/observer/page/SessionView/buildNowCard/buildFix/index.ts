import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent, RunningWork, Status } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import formatRunningFor from "@/observer/page/SessionView/buildNowCard/formatRunningFor/index.js";
import findOpenCount from "./findOpenCount/index.js";
import findOpenIssues from "./findOpenIssues/index.js";

/**
 * The red card for the QA to Fix loop: the round, how many of the module's todo issues are still
 * open (when the status read its todo.aide) and, when the newest QA verdict reported an open count,
 * the line that says so. Nothing is inferred for a round the observer did not report.
 */
export default function buildFix({
	status,
	events,
	work,
	now,
	pipeline = null,
}: {
	status: Status;
	events: ObserverEvent[];
	work: RunningWork;
	now: Date;
	/** The pipeline of the running session's rail, when it names one. */
	pipeline?: string | null;
}): NowCardModel {
	const round = work.qaFixRound;
	const issues = findOpenIssues({ status, module: work.module });
	const open = findOpenCount({ projectRoot: status.projectRoot, events, module: work.module });
	const started = formatClock({ iso: work.startedAt, now }).clock;
	return {
		kind: "fix",
		state: round === undefined ? "QA → Fix" : `QA → Fix · round ${round}`,
		icon: "loop",
		title: PHASE_LABELS[work.phase],
		titleMono: null,
		sub: issues === null ? null : `${issues.open} of ${issues.total} issues open`,
		parts: [
			{ label: "agent", value: work.agent, mono: true },
			{ label: "module", value: work.module, mono: true },
		],
		time: formatRunningFor({ elapsedMs: work.elapsedMs, asOf: status.generatedAt, now }),
		timeLabel: round === undefined ? `elapsed · started ${started}` : `elapsed · round ${round} started ${started}`,
		steps: null,
		hint: round === undefined || open === null ? null : `QA round ${round} found ${open} still open in todo.aide.`,
		pipeline,
	};
}
