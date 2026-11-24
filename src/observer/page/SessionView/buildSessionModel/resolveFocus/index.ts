import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";

/**
 * The session the card, rail and history follow: the one the header switcher picked while two or
 * more sessions are live or idle and the pick is one of them, else the session the link names.
 * A pick that has since ended, or a switcher that has since gone, falls back to the link's session.
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
	const active = sessions.filter(isActiveSession);
	return active.length >= 2 && active.some((session) => session.sessionId === requested) ? requested : routeSessionId;
}
