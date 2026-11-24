import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent, Phase, RailPhase } from "@/types/index.js";
import type { IdleRail } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

type ModuleEvent = Extract<ObserverEvent, { kind: "phase_started" | "phase_finished" | "qa_verdict" }>;

/**
 * The rail an idle or no-root session still shows: the module of the newest phase or verdict event
 * (of `sessionId` when given, else of any held session) with the phases that session reported
 * finished for it, every other phase not run. The observer's own rail covers running and waiting
 * work; this stands in once none is left, reading only reported events. Null when no event names a
 * module.
 */
export default function buildIdleRail({
	events,
	projectRoot,
	sessionId,
}: {
	events: ObserverEvent[];
	projectRoot: string;
	sessionId?: string;
}): IdleRail | null {
	const scoped = events.filter((event) => sessionId === undefined || event.sessionId === sessionId);
	const named = scoped
		.filter((event): event is ModuleEvent => event.kind === "phase_started" || event.kind === "phase_finished" || event.kind === "qa_verdict")
		.sort((a, b) => a.seq - b.seq)
		.at(-1);
	if (!named) return null;

	const module = normalizeModule({ projectRoot, module: named.module });
	const finished = new Set<Phase>();
	for (const event of scoped) {
		if (event.kind !== "phase_finished" || event.sessionId !== named.sessionId) continue;
		if (normalizeModule({ projectRoot, module: event.module }) === module) finished.add(event.phase);
	}
	const phases = (Object.keys(PHASE_LABELS) as Phase[]).map(
		(phase): RailPhase => ({ phase, label: PHASE_LABELS[phase], state: finished.has(phase) ? "done" : "not-run" }),
	);
	return { module: named.module, sessionId: named.sessionId, phases };
}
