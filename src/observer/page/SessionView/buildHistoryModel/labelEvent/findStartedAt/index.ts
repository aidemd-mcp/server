import type { ObserverEvent } from "@/types/index.js";

type FinishedEvent = Extract<ObserverEvent, { kind: "phase_finished" }>;

/** The `ts` of the latest earlier `phase_started` of the same session, phase and module as `finished`, or null when none was recorded. */
export default function findStartedAt({ finished, events }: { finished: FinishedEvent; events: ObserverEvent[] }): string | null {
	let latest: ObserverEvent | null = null;
	for (const event of events) {
		if (event.kind !== "phase_started" || event.sessionId !== finished.sessionId) continue;
		if (event.phase !== finished.phase || event.module !== finished.module || event.seq >= finished.seq) continue;
		if (latest === null || event.seq > latest.seq) latest = event;
	}
	return latest?.ts ?? null;
}
