import type { ObserverEvent } from "@/types/index.js";
import normalizeProjectPath from "../shared/normalizeProjectPath/index.js";
import PHASE_LABELS from "../shared/phaseLabels/index.js";
import type { Phase, PhaseRail, RailPhase, RunningWork, WaitingFile } from "../types/index.js";

/** The closed phase list in rail order: the key order of `PHASE_LABELS`. */
const PHASES = Object.keys(PHASE_LABELS) as Phase[];

/**
 * Collects the phases a session reported finished for one module. The event's
 * module matches when its normalized project path equals the rail module, or,
 * when it lies outside the project, when its text as given equals it.
 */
function findFinishedPhases({
	projectRoot,
	events,
	sessionId,
	module,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	sessionId: string;
	module: string;
}): Set<Phase> {
	const finished = new Set<Phase>();
	for (const event of events) {
		if (event.kind !== "phase_finished" || event.sessionId !== sessionId) continue;
		const eventModule = normalizeProjectPath({ projectRoot, path: event.module }) ?? event.module;
		if (eventModule === module) finished.add(event.phase);
	}
	return finished;
}

/**
 * Builds the phase rail for one module from reported events only: the phase
 * running now and the phases finished in that session for that module, every
 * other phase of the closed list as not-run. Reads no file, predicts no next
 * step and does no I/O. The module is the newest running work's, else the
 * surfaced file's, else there is no rail.
 */
export default function buildRail({
	projectRoot,
	events,
	running,
	surfaced,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	running: RunningWork[];
	surfaced: WaitingFile | null;
}): PhaseRail | null {
	// Step 1: pick the rail's module and session, the running work first.
	const current = running[0];
	if (!current && !surfaced) return null;
	const source = current ? "running" : "surfaced";
	const module = current ? current.module : surfaced!.folder;
	const sessionId = current ? current.sessionId : surfaced!.sessionId;

	// Step 2: the phases that session finished for that module.
	const finished = findFinishedPhases({ projectRoot, events, sessionId, module });

	// Step 3: one entry per phase of the closed list; running wins over an earlier finish.
	const phases = PHASES.map((phase): RailPhase => {
		const label = PHASE_LABELS[phase];
		if (current && phase === current.phase) {
			return {
				phase,
				label,
				state: "running",
				...(current.buildStep ? { buildStep: current.buildStep } : {}),
				...(current.qaFixRound !== undefined ? { qaFixRound: current.qaFixRound } : {}),
			};
		}
		return { phase, label, state: finished.has(phase) ? "done" : "not-run" };
	});

	// Step 4: the rail.
	return { module, sessionId, source, phases };
}
