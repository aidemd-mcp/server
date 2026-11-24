import buildHref from "@/observer/page/route/buildHref/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { SessionHeaderModel, SessionRoute, SessionRowModel, SwitcherOption } from "@/observer/page/types/index.js";

/**
 * The session header's words: the link home, the project, the start of the session the link names
 * (from its row, else its first held event), and the reported root and kanban tag, each only when
 * the stream reported one. The switcher comes from its own builder and rides along.
 */
export default function buildHeader({
	route,
	name,
	sessions,
	firstEventAt,
	rootPath,
	kanbanTag,
	switcher,
	now,
}: {
	route: Pick<SessionRoute, "token" | "sessionId">;
	name: string;
	sessions: SessionRowModel[];
	firstEventAt: string | null;
	rootPath: string | undefined;
	kanbanTag: string | undefined;
	switcher: SwitcherOption[];
	now: Date;
}): SessionHeaderModel {
	const startIso = sessions.find((session) => session.sessionId === route.sessionId)?.startedAt ?? firstEventAt;
	return {
		homeHref: buildHref({ kind: "home", token: route.token }),
		project: name,
		sessionStart: startIso === null ? null : formatClock({ iso: startIso, now }).clock,
		rootPath: rootPath ?? null,
		kanbanTag: kanbanTag ?? null,
		switcher,
	};
}
