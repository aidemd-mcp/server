import type { ObserverEvent } from "@/types/index.js";
import findCurrentPipeline from "../shared/findCurrentPipeline/index.js";
import PHASE_LABELS from "../shared/phaseLabels/index.js";
import type { Phase, PipelineRail, RailPhase, RunningWork, SessionSummary } from "../types/index.js";
import collectPipelineEvents from "./collectPipelineEvents/index.js";
import isOutside from "./isOutside/index.js";
import judgeStage from "./judgeStage/index.js";

/** The closed phase list in rail order: the key order of `PHASE_LABELS`. */
const PHASES = Object.keys(PHASE_LABELS) as Phase[];

/**
 * Builds one rail per session that has not ended, in the order of `sessions`
 * (an ended session has no rail, brief #86). A rail shows the session's current
 * pipeline, or the last one it finished until another starts, resumed from
 * earlier sessions through their events and the archived ones. The stage of
 * the session's running work is `running`; every other stage is judged from
 * that pipeline's events: `skipped` only from a skip report, `done` from
 * evidence about that stage, else `pending`. `outside` says the session works
 * outside the pipeline. Reads no file and does no I/O.
 */
export default function buildRails({
	events,
	archivedEvents,
	sessions,
	running,
}: {
	events: ObserverEvent[];
	archivedEvents: ObserverEvent[];
	sessions: SessionSummary[];
	running: RunningWork[];
}): PipelineRail[] {
	return sessions
		.filter((session) => session.liveness.state !== "ended")
		.map((session): PipelineRail => {
			// Step 1: this session's events, and everyone else's for resuming the pipeline.
			const sessionEvents = events.filter((event) => event.sessionId === session.sessionId);
			const otherEvents = [...events, ...archivedEvents].filter((event) => event.sessionId !== session.sessionId);

			// Step 2: the session's current pipeline and that pipeline's events across sessions.
			const current = findCurrentPipeline({ events: sessionEvents });
			const pipelineEvents = collectPipelineEvents({
				sessionEvents,
				otherEvents,
				pipeline: current?.pipeline ?? null,
			});

			// Step 3: one stage per phase; the running work wins, the rest are judged.
			const work = running.find((entry) => entry.sessionId === session.sessionId) ?? null;
			const stages = PHASES.map((phase): RailPhase => {
				const label = PHASE_LABELS[phase];
				if (work && work.phase === phase) {
					return {
						phase,
						label,
						state: "running",
						...(work.buildStep ? { buildStep: work.buildStep } : {}),
						...(work.qaFixRound !== undefined ? { qaFixRound: work.qaFixRound } : {}),
					};
				}
				const judged = judgeStage({ phase, pipelineEvents });
				return {
					phase,
					label,
					state: judged.state,
					...(judged.reason !== undefined ? { reason: judged.reason } : {}),
				};
			});

			// Step 4: the rail.
			return {
				sessionId: session.sessionId,
				pipeline: current?.pipeline ?? null,
				pipelineState: current?.state ?? "none",
				outside: isOutside({ sessionEvents, running: work }),
				stages,
			};
		});
}
