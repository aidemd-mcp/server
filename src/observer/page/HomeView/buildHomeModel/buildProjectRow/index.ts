import type { HeldSession, ProjectListing, ProjectView, SessionListing } from "@/observer/types/index.js";
import buildHref from "@/observer/page/route/buildHref/index.js";
import formatLastActivity from "@/observer/page/shared/formatLastActivity/index.js";
import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import projectName from "@/observer/page/shared/projectName/index.js";
import buildSessionRows from "@/observer/page/SessionView/buildSessionRows/index.js";
import type { ProjectRowModel } from "@/observer/page/types/index.js";
import findKanbanTag from "./findKanbanTag/index.js";
import findLastEventAt from "./findLastEventAt/index.js";

/**
 * One project's Home entry. Sessions come from the ready status, else the sessions frame, else the
 * project's own listing; a project with no reported root is listed under its key like any other.
 * `openHref` is its newest session's link, null when it has none.
 */
export default function buildProjectRow({
	token,
	project,
	view,
	listings,
	held,
	now,
}: {
	token: string;
	project: ProjectListing;
	view: ProjectView | undefined;
	listings: SessionListing[] | undefined;
	held: HeldSession[];
	now: Date;
}): ProjectRowModel {
	const { projectKey } = project;
	const sessions = listings ?? project.sessions;
	const status = view?.state === "ready" ? view.status : null;
	const rows = buildSessionRows({
		summaries: status?.sessions,
		listings: sessions,
		held: held.filter((session) => session.projectKey === projectKey),
	});
	const projectRoot = project.projectRoot ?? status?.projectRoot ?? null;
	const lastEventAt = findLastEventAt({ rows, listed: project.lastEventAt });
	return {
		projectKey,
		name: projectName({ projectRoot, projectKey }),
		root: projectRoot,
		kanbanTag: findKanbanTag({ view, sessions }),
		liveCount: rows.filter(isActiveSession).length,
		waiting: (status?.waiting.length ?? 0) > 0,
		lastEventAt,
		lastActivity: lastEventAt === null ? null : formatLastActivity({ iso: lastEventAt, now }),
		rows,
		openHref: rows.length === 0 ? null : buildHref({ kind: "session", token, projectKey, sessionId: rows[0].sessionId }),
	};
}
