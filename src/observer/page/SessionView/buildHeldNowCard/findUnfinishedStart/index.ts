import type { ObserverEvent } from "@/types/index.js";

type StartedEvent = Extract<ObserverEvent, { kind: "phase_started" }>;

/**
 * The newest `phase_started` of one session with no later `phase_finished` for the same phase and
 * module: the work a project without a status can still tell is running. Null when none is open.
 */
export default function findUnfinishedStart({ events, sessionId }: { events: ObserverEvent[]; sessionId: string | null }): StartedEvent | null {
	const ordered = events.filter((event) => event.sessionId === sessionId).sort((a, b) => a.seq - b.seq);
	let open: StartedEvent[] = [];
	for (const event of ordered) {
		if (event.kind === "phase_started") open.push(event);
		if (event.kind !== "phase_finished") continue;
		const finishedAt = open.map((started) => started.phase === event.phase && started.module === event.module).lastIndexOf(true);
		open = open.filter((_, index) => index !== finishedAt);
	}
	return open.at(-1) ?? null;
}
