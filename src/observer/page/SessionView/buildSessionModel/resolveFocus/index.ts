import type { SessionRowModel } from "@/observer/page/types/index.js";

/**
 * The session the card, rail and history follow: the one picked in the History bar's session picker
 * (or the header switcher) while the project still lists it, else the session the link names.
 * Picking never navigates; the rest of the page is the project's current files either way.
 */
export default function resolveFocus({
	requested,
	routeSessionId,
	sessions,
}: {
	requested: string;
	routeSessionId: string;
	sessions: SessionRowModel[];
}): string {
	return sessions.some((session) => session.sessionId === requested) ? requested : routeSessionId;
}
