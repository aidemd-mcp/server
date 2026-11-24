import type { ObserverEvent } from "@/types/index.js";
import type { ModuleNode, RunningWork, SessionSummary, WorkFileEntry } from "../types/index.js";
import normalizeProjectPath from "../shared/normalizeProjectPath/index.js";

type PhaseStarted = Extract<ObserverEvent, { kind: "phase_started" }>;
type PlanEntry = WorkFileEntry & { kind: "plan" };

/**
 * Finds the phase each live or idle session is running right now, newest first.
 * Events say who and when; files decide whether it can be true: a Build entry
 * is dropped unless the module's plan is approved, and the Build step comes
 * from the plan file, never from `plan_step_checked` events. An ended session
 * runs nothing.
 */
export default function findRunningWork({
	projectRoot,
	events,
	sessions,
	nodes,
	now,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	sessions: SessionSummary[];
	nodes: ModuleNode[];
	now: number;
}): RunningWork[] {
	const normalizeModule = (module: string): string => normalizeProjectPath({ projectRoot, path: module }) ?? module;

	const running: RunningWork[] = [];
	for (const session of sessions) {
		if (session.liveness === "ended") continue;

		// Step 1: this session's events in seq order.
		const ordered = events.filter((event) => event.sessionId === session.sessionId).sort((a, b) => a.seq - b.seq);

		// Step 2: the open phase is the latest start with no later finish of the same phase and module.
		const opened = findOpenPhase({ ordered, normalizeModule });
		if (!opened) continue;

		const module = normalizeModule(opened.started.module);
		const plan = findPlan({ nodes, module });

		// Step 3: files win — the plan says Build cannot be running unless it is approved.
		if (opened.started.phase === "build" && !isApproved(plan)) continue;

		const work: RunningWork = {
			sessionId: session.sessionId,
			phase: opened.started.phase,
			agent: opened.started.agent,
			module,
			startedAt: opened.started.ts,
			elapsedMs: now - Date.parse(opened.started.ts),
		};

		// Step 4: Build step n of m comes from the plan file.
		if (opened.started.phase === "build" && plan?.read.state === "present" && plan.read.steps.total > 0) {
			const { done, total } = plan.read.steps;
			work.buildStep = { reached: Math.min(done + 1, total), total };
		}

		// Step 5: QA/Fix round counts this session's verdicts for the module before the open phase.
		if (opened.started.phase === "qa" || opened.started.phase === "fix") {
			const verdicts = ordered.filter(
				(event) =>
					event.kind === "qa_verdict" &&
					event.seq < opened.started.seq &&
					normalizeModule(event.module) === module,
			).length;
			work.qaFixRound = opened.started.phase === "qa" ? verdicts + 1 : Math.max(verdicts, 1);
		}

		running.push(work);
	}

	// Step 6: newest start first; ties by sessionId descending, so running[0] is deterministic.
	return running.sort((a, b) => {
		if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
		if (a.sessionId === b.sessionId) return 0;
		return a.sessionId < b.sessionId ? 1 : -1;
	});
}

/** The latest `phase_started` of the session, unless a later `phase_finished` closed it. */
function findOpenPhase({
	ordered,
	normalizeModule,
}: {
	ordered: ObserverEvent[];
	normalizeModule: (module: string) => string;
}): { started: PhaseStarted } | null {
	const startedEvents = ordered.filter((event): event is PhaseStarted => event.kind === "phase_started");
	const started = startedEvents[startedEvents.length - 1];
	if (!started) return null;

	const module = normalizeModule(started.module);
	const closed = ordered.some(
		(event) =>
			event.kind === "phase_finished" &&
			event.seq > started.seq &&
			event.phase === started.phase &&
			normalizeModule(event.module) === module,
	);
	return closed ? null : { started };
}

/** The module's plan entry, or null when the module has no node or no plan. */
function findPlan({ nodes, module }: { nodes: ModuleNode[]; module: string }): PlanEntry | null {
	const node = nodes.find((candidate) => candidate.folder === module);
	const plan = node?.files.find((file): file is PlanEntry => file.kind === "plan");
	return plan ?? null;
}

/** True only when the plan is present and its status reads `approved`. */
function isApproved(plan: PlanEntry | null): boolean {
	return plan?.read.state === "present" && plan.read.status === "approved";
}
