import type { ObserverEvent } from "@/types/index.js";

/** True when any event records more than the session opening and a prompt, which is where an empty card ends and an idle one begins. */
export default function hasActivity({ events }: { events: ObserverEvent[] }): boolean {
	return events.some((event) => event.kind !== "session_started" && event.kind !== "prompt");
}
