import type { ObserverEvent } from "@/types/index.js";

type VerdictEvent = Extract<ObserverEvent, { kind: "qa_verdict" }>;

/** The pipeline's `qa_verdict` events, oldest first: their count is the QA round, the last is the verdict now. */
export default function findVerdicts({ pipelineEvents }: { pipelineEvents: ObserverEvent[] }): VerdictEvent[] {
	return pipelineEvents.filter((event): event is VerdictEvent => event.kind === "qa_verdict");
}
