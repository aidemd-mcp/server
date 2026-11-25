import type { ObserverEvent } from "@/types/index.js";
import type { RunningWork } from "../../types/index.js";

/**
 * True when the session works outside the pipeline: no phase of it is running
 * and the newest event that is not a `prompt` is a `file_written` or a
 * `commit`. A session with no such event is not outside. Pure.
 */
export default function isOutside({
	sessionEvents,
	running,
}: {
	sessionEvents: ObserverEvent[];
	running: RunningWork | null;
}): boolean {
	if (running) return false;

	const newest = sessionEvents
		.filter((event) => event.kind !== "prompt")
		.reduce<ObserverEvent | null>((best, event) => (best === null || event.seq > best.seq ? event : best), null);
	return newest !== null && (newest.kind === "file_written" || newest.kind === "commit");
}
