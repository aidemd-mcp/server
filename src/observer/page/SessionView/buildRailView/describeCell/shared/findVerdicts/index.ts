import type { ObserverEvent } from "@/types/index.js";

type VerdictEvent = Extract<ObserverEvent, { kind: "qa_verdict" }>;

/** The module's `qa_verdict` events in the rail's session, oldest first: their count is the QA round, the last is the verdict now. */
export default function findVerdicts({ moduleEvents }: { moduleEvents: ObserverEvent[] }): VerdictEvent[] {
	return moduleEvents.filter((event): event is VerdictEvent => event.kind === "qa_verdict");
}
