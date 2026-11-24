import type { ObserverEvent } from "@/types/index.js";

type ResolvedEvent = Extract<ObserverEvent, { kind: "gate_resolved" }>;

/**
 * The `ts` of the `gate_waiting` that this `gate_resolved` answers: the latest earlier one of the
 * same session for the same file. Null when that event is not held, so the row says nothing of the wait.
 */
export default function findWaited({
	resolved,
	events,
	sameFile,
}: {
	resolved: ResolvedEvent;
	events: ObserverEvent[];
	sameFile(file: string): boolean;
}): string | null {
	let latest: ObserverEvent | null = null;
	for (const event of events) {
		if (event.kind !== "gate_waiting" || event.sessionId !== resolved.sessionId || event.seq >= resolved.seq) continue;
		if (!sameFile(event.file)) continue;
		if (latest === null || event.seq > latest.seq) latest = event;
	}
	return latest?.ts ?? null;
}
