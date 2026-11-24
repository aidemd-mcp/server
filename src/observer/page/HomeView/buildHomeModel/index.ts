import type { WaitingFile } from "@/types/index.js";
import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import type { HomeModel, ProjectRowModel, SessionRowModel, StreamState } from "@/observer/page/types/index.js";
import buildLiveRow from "./buildLiveRow/index.js";
import buildProjectRow from "./buildProjectRow/index.js";
import buildWaitCard from "./buildWaitCard/index.js";
import compareNewest from "./compareNewest/index.js";
import compareProjects from "./compareProjects/index.js";

/** Projects with more than this many get a filter field. */
const FILTER_THRESHOLD = 6;

/**
 * Everything Home shows, from what the stream holds. Wait cards are every open waiting file of every
 * ready project, newest first; live rows are every live or idle session across projects, newest
 * first; projects are sorted by their latest event, each with its sessions. The pill reads
 * `recon` while the stream is down, else `live` while any session is live, else `idle`. With no
 * project list yet, nothing shows (and `empty` stays false, so no empty notice flashes).
 */
export default function buildHomeModel({ state, now, token }: { state: StreamState; now: Date; token: string }): HomeModel {
	const projects = (state.projects ?? []).map((project) =>
		buildProjectRow({ token, project, view: state.views[project.projectKey], listings: state.listings[project.projectKey], held: state.held, now }),
	);

	const waits: { project: ProjectRowModel; waiting: WaitingFile }[] = [];
	const live: { project: ProjectRowModel; session: SessionRowModel }[] = [];
	for (const project of projects) {
		const view = state.views[project.projectKey];
		for (const waiting of view?.state === "ready" ? view.status.waiting : []) waits.push({ project, waiting });
		for (const session of project.rows.filter(isActiveSession)) live.push({ project, session });
	}
	waits.sort((a, b) => compareNewest(a.waiting.since, b.waiting.since));
	live.sort((a, b) => compareNewest(a.session.startedAt, b.session.startedAt));

	const liveRows = live.map(({ project, session }) => {
		const view = state.views[project.projectKey];
		return buildLiveRow({
			token,
			project: { projectKey: project.projectKey, name: project.name },
			session,
			status: view?.state === "ready" ? view.status : null,
			now,
		});
	});

	return {
		subtitle:
			projects.length === 0
				? "On this machine (127.0.0.1)"
				: `${projects.length} ${projects.length === 1 ? "project" : "projects"} · ${liveRows.length} live ${liveRows.length === 1 ? "session" : "sessions"} · on this machine (127.0.0.1)`,
		conn: state.connection === "reconnecting" ? "recon" : live.some(({ session }) => session.liveness === "live") ? "live" : "idle",
		empty: state.projects !== null && projects.length === 0,
		filterable: projects.length > FILTER_THRESHOLD,
		waits: waits.map(({ project, waiting }) =>
			buildWaitCard({ token, project: { projectKey: project.projectKey, name: project.name }, waiting, now }),
		),
		live: liveRows,
		projects: projects.sort(compareProjects),
	};
}
