import type { ObserverEvent } from "@/types/index.js";
import normalizeProjectPath from "../normalizeProjectPath/index.js";

type PhaseStartedEvent = Extract<ObserverEvent, { kind: "phase_started" }>;

/**
 * The phase a session has open right now within one pipeline's scope, or null.
 * `pipeline` as a string looks only at events of that pipeline; `null` looks
 * only at events with no `pipeline` field (v1 logs and work outside a
 * pipeline). The newest `phase_started` in scope is open unless a later event
 * closes it: a `phase_finished` of the same phase and the same normalized
 * module (the text as given when it cannot be normalized), a later
 * `phase_started` in the same scope, any later `commit`, or a later
 * `pipeline_finished` of that pipeline. An event of another pipeline never
 * closes it. Pure: touches no file.
 *
 * This is the one rule the status and the start tool's HALT share (brief
 * #100): computing it twice would let the two disagree.
 */
export default function findOpenPhase({
	projectRoot,
	events,
	pipeline,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	pipeline: string | null;
}): PhaseStartedEvent | null {
	const normalizeModule = (module: string): string => normalizeProjectPath({ projectRoot, path: module }) ?? module;
	const inScope = (event: ObserverEvent): boolean => {
		const named = "pipeline" in event ? event.pipeline : undefined;
		return pipeline === null ? named === undefined : named === pipeline;
	};

	// Step 1: the newest phase_started in scope.
	const ordered = [...events].sort((a, b) => a.seq - b.seq);
	const startedEvents = ordered.filter(
		(event): event is PhaseStartedEvent => event.kind === "phase_started" && inScope(event),
	);
	const started = startedEvents[startedEvents.length - 1];
	if (!started) return null;

	// Step 2: any later event that closes it.
	const module = normalizeModule(started.module);
	const closed = ordered.some((event) => {
		if (event.seq <= started.seq) return false;
		switch (event.kind) {
			case "commit":
				return true;
			case "phase_started":
				return inScope(event);
			case "phase_finished":
				return inScope(event) && event.phase === started.phase && normalizeModule(event.module) === module;
			case "pipeline_finished":
				return pipeline !== null && event.pipeline === pipeline;
			default:
				return false;
		}
	});
	return closed ? null : started;
}
