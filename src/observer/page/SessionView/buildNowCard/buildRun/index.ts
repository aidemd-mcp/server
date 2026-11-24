import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { RunningWork } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";

/**
 * The blue card for a phase running now: the phase, the agent and module that run it, how long
 * (`elapsed`, already worded by the caller) and since when. Build adds `step n of m` and the step bar
 * (earlier steps done, the reached one running) with the step's own words once `stepText` is loaded.
 */
export default function buildRun({
	work,
	elapsed,
	stepText,
	now,
}: {
	work: Pick<RunningWork, "phase" | "agent" | "module" | "startedAt" | "buildStep">;
	elapsed: string;
	stepText: string | null;
	now: Date;
}): NowCardModel {
	const step = work.phase === "build" ? work.buildStep : undefined;
	return {
		kind: "run",
		state: "Running",
		icon: "run",
		title: PHASE_LABELS[work.phase],
		titleMono: null,
		sub: step ? `step ${step.reached} of ${step.total}` : null,
		parts: [
			{ label: "agent", value: work.agent, mono: true },
			{ label: "module", value: work.module, mono: true },
		],
		time: elapsed,
		timeLabel: `elapsed · started ${formatClock({ iso: work.startedAt, now }).clock}`,
		steps: step ? { total: step.total, done: step.reached - 1, running: 1, head: `Step ${step.reached} of ${step.total}`, text: stepText } : null,
		hint: null,
	};
}
