import type { ObserverEvent, WaitingFile } from "@/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/**
 * The agent that last reported finishing a phase for the waiting file's module in the waiting
 * session before the gate opened, or null when none did: who wrote the file the user is asked to approve.
 */
export default function findWriter({
	projectRoot,
	events,
	waiting,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	waiting: WaitingFile;
}): string | null {
	let newest: Extract<ObserverEvent, { kind: "phase_finished" }> | null = null;
	for (const event of events) {
		if (event.kind !== "phase_finished" || event.sessionId !== waiting.sessionId || event.seq >= waiting.seq) continue;
		if (normalizeModule({ projectRoot, module: event.module }) !== waiting.folder) continue;
		if (newest === null || event.seq > newest.seq) newest = event;
	}
	return newest?.agent ?? null;
}
