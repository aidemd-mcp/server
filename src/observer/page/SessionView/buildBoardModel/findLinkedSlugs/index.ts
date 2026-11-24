import type { ObserverEvent } from "@/types/index.js";

/** The slugs the focused session's `task` events name (picked or moved): the tasks the board outlines as this session's. */
export default function findLinkedSlugs({ events, focus }: { events: ObserverEvent[]; focus: string }): Set<string> {
	const slugs = new Set<string>();
	for (const event of events) if (event.kind === "task" && event.sessionId === focus) slugs.add(event.slug);
	return slugs;
}
