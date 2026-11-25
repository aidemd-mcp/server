import type { ObserverEvent } from "@/types/index.js";

/**
 * The pipeline a session is in and whether it is still running, from the
 * session's own events in any order (sorted by `seq` inside). The newest
 * `pipeline_started` or `pipeline_finished` decides: started means running,
 * finished means finished. With neither, the `pipeline` of the newest event
 * that carries one means running. A session with no pipeline anywhere (a v1
 * log, or work outside the pipeline) returns null. Pure: touches no file.
 *
 * This is the one rule the status rails and the start tool's HALT share
 * (brief #100): computing it twice would let the two disagree.
 */
export default function findCurrentPipeline({
	events,
}: {
	events: ObserverEvent[];
}): { pipeline: string; state: "running" | "finished" } | null {
	const ordered = [...events].sort((a, b) => a.seq - b.seq);

	// Step 1: the newest boundary event decides.
	for (let i = ordered.length - 1; i >= 0; i--) {
		const event = ordered[i];
		if (event.kind === "pipeline_started") return { pipeline: event.pipeline, state: "running" };
		if (event.kind === "pipeline_finished") return { pipeline: event.pipeline, state: "finished" };
	}

	// Step 2: no boundary reported; the newest event that names a pipeline means it is running.
	for (let i = ordered.length - 1; i >= 0; i--) {
		const event = ordered[i];
		if ("pipeline" in event && event.pipeline) return { pipeline: event.pipeline, state: "running" };
	}

	return null;
}
