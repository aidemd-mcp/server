import type { ObserverEvent } from "@/types/index.js";
import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";

/**
 * The sessions the history shows: the focused session (the one picked in the History bar, else the
 * link's) alone when the project lists it, else every live or idle session, else the focused one.
 * With no session listed at all, every session the events name is shown.
 */
export default function pickSessionIds({
	sessions,
	focus,
	events,
}: {
	sessions: SessionRowModel[];
	focus: string;
	events: ObserverEvent[];
}): string[] {
	if (sessions.length === 0) return [...new Set(events.map((event) => event.sessionId))];
	const focused = sessions.find((session) => session.sessionId === focus);
	const running = sessions.filter(isActiveSession).map((session) => session.sessionId);
	if (focused !== undefined) return [focus];
	return running.length > 0 ? running : [focus];
}
