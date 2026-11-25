import type { ObserverEvent } from "@/types/index.js";
import type { ModuleNode, RunningWork, SessionSummary, WorkFileEntry } from "../types/index.js";
import findCurrentPipeline from "../shared/findCurrentPipeline/index.js";
import findOpenPhase from "../shared/findOpenPhase/index.js";
import normalizeProjectPath from "../shared/normalizeProjectPath/index.js";

type PlanEntry = WorkFileEntry & { kind: "plan" };

/**
 * Finds the phase each session that has not ended is running right now, newest
 * first. Events say who and when; files decide whether it can be true: a Build
 * entry is dropped unless the module's plan is approved, and the Build step
 * comes from the plan file, never from `plan_step_checked` events. The open
 * phase is the one rule `findCurrentPipeline` and `findOpenPhase` share with
 * the start tool's HALT (brief #100): the session's current pipeline, then the
 * open phase within it, so a commit closes it. An ended session runs nothing.
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
		if (session.liveness.state === "ended") continue;

		// Step 1: this session's events in seq order.
		const ordered = events.filter((event) => event.sessionId === session.sessionId).sort((a, b) => a.seq - b.seq);

		// Step 2: the open phase of the session's current pipeline (the pipeline-less scope when it has none).
		const current = findCurrentPipeline({ events: ordered });
		const pipeline = current?.pipeline ?? null;
		const started = findOpenPhase({ projectRoot, events: ordered, pipeline });
		if (!started) continue;

		const module = normalizeModule(started.module);
		const plan = findPlan({ nodes, module });

		// Step 3: files win — the plan says Build cannot be running unless it is approved.
		if (started.phase === "build" && !isApproved(plan)) continue;

		const work: RunningWork = {
			sessionId: session.sessionId,
			phase: started.phase,
			agent: started.agent,
			module,
			startedAt: started.ts,
			elapsedMs: now - Date.parse(started.ts),
		};

		// Step 4: Build step n of m comes from the plan file.
		if (started.phase === "build" && plan?.read.state === "present" && plan.read.steps.total > 0) {
			const { done, total } = plan.read.steps;
			work.buildStep = { reached: Math.min(done + 1, total), total };
		}

		// Step 5: QA/Fix round counts this session's verdicts of the same pipeline scope for the module before the open phase.
		if (started.phase === "qa" || started.phase === "fix") {
			const verdicts = ordered.filter(
				(event) =>
					event.kind === "qa_verdict" &&
					event.seq < started.seq &&
					(event.pipeline ?? null) === pipeline &&
					normalizeModule(event.module) === module,
			).length;
			work.qaFixRound = started.phase === "qa" ? verdicts + 1 : Math.max(verdicts, 1);
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
