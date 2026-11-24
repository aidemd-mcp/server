import type { ObserverEvent } from "@/types/index.js";

/** One event with the envelope filled in; `fields` carries `kind` and that kind's fields. */
export default function makeEvent({ seq, ts, sessionId = "s1", ...fields }: { seq: number; ts: string; sessionId?: string } & Record<string, unknown>): ObserverEvent {
	return { v: 1, pid: 1, seq, ts, sessionId, ...fields } as ObserverEvent;
}
