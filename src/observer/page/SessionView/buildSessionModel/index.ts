import buildDocumentTitle from "@/observer/page/shared/buildDocumentTitle/index.js";
import projectName from "@/observer/page/shared/projectName/index.js";
import type { SessionModel, SessionRoute, StreamState } from "@/observer/page/types/index.js";
import buildBoardModel from "@/observer/page/SessionView/buildBoardModel/index.js";
import buildConnView from "@/observer/page/SessionView/buildConnView/index.js";
import buildHeldNowCard from "@/observer/page/SessionView/buildHeldNowCard/index.js";
import buildHistoryModel from "@/observer/page/SessionView/buildHistoryModel/index.js";
import buildModules from "@/observer/page/SessionView/buildModules/index.js";
import buildNowCard from "@/observer/page/SessionView/buildNowCard/index.js";
import buildPlanRows from "@/observer/page/SessionView/buildPlanRows/index.js";
import buildRailView from "@/observer/page/SessionView/buildRailView/index.js";
import buildRecordModel from "@/observer/page/SessionView/buildRecordModel/index.js";
import buildSessionRows from "@/observer/page/SessionView/buildSessionRows/index.js";
import buildTreeModel from "@/observer/page/SessionView/buildTreeModel/index.js";
import pickCurrentLabel from "@/observer/page/SessionView/buildTreeModel/pickCurrentLabel/index.js";
import buildHeader from "./buildHeader/index.js";
import buildSwitcher from "./buildSwitcher/index.js";
import buildTabs from "./buildTabs/index.js";
import buildWaitBanner from "./buildWaitBanner/index.js";
import findKanbanTag from "./findKanbanTag/index.js";
import findLastUpdate from "./findLastUpdate/index.js";
import resolveFocus from "./resolveFocus/index.js";

/**
 * Derives everything the session view draws from the stream state, as one pure step. The project's
 * view is ready (a status), has no reported root (events and sessions only: its tree and plans are
 * `unavailable` and `null`, its board a calm notice), or has not arrived yet. `focus` is the
 * session the switcher picked; it holds only while two sessions are active, else the link's
 * session is followed. `ui.stepText` is the running Build step's own words, loaded by the view.
 * Every elapsed and "ago" reading is taken at `now`.
 */
export default function buildSessionModel({
	state,
	route,
	focus,
	now,
	ui,
}: {
	state: StreamState;
	route: SessionRoute;
	focus: string;
	now: Date;
	ui: { stepText: string | null };
}): SessionModel {
	const view = state.views[route.projectKey] ?? null;
	const status = view?.state === "ready" ? view.status : null;
	const held = state.held.filter((session) => session.projectKey === route.projectKey);
	const events = held.flatMap((session) => session.events);
	const name = projectName({ projectRoot: status?.projectRoot, projectKey: route.projectKey });

	const sessions = buildSessionRows({
		...(status ? { summaries: status.sessions } : {}),
		...(!status && state.listings[route.projectKey] ? { listings: state.listings[route.projectKey] } : {}),
		held,
	});
	const followed = resolveFocus({ requested: focus, routeSessionId: route.sessionId, sessions });

	const card = status ? buildNowCard({ status, events, focus: followed, now, stepText: ui.stepText }) : buildHeldNowCard({ events, focus: followed, now });
	const { phases, lanes, module: current } = buildRailView({ status, events, focus: followed, now });
	const modules = status ? buildModules({ tree: status.tree }) : [];
	const noRoot = view?.state === "no-project-root";

	const tree = noRoot ? ({ kind: "unavailable" } as const) : buildTreeModel({ modules, current, currentLabel: pickCurrentLabel({ card }) });
	const plans = noRoot ? null : buildPlanRows({ modules, current });
	const board = buildBoardModel({ view, events, focus: followed });

	return {
		status,
		events,
		sessions,
		focus: followed,
		header: buildHeader({
			route,
			name,
			sessions,
			firstEventAt: held.find((session) => session.sessionId === route.sessionId)?.events[0]?.ts ?? null,
			rootPath: status?.projectRoot,
			kanbanTag: (status?.board.state === "available" ? status.board.kanbanTag : undefined) ?? findKanbanTag({ events }),
			switcher: buildSwitcher({ sessions, status, focus: followed, name, now }),
			now,
		}),
		conn:
			state.connection === "not-found"
				? null
				: buildConnView({ connection: state.connection, session: sessions.find((session) => session.sessionId === followed) ?? null }),
		notFound: state.connection === "not-found",
		reconnecting: state.connection === "reconnecting",
		lastUpdate: findLastUpdate({ events }),
		waiting: buildWaitBanner({ status, focus: followed, name, now }),
		surfaced: status?.surfaced ?? null,
		notInstalled: status !== null && status.tree.length === 0 ? { projectRoot: status.projectRoot } : null,
		card,
		phases,
		lanes,
		tree,
		plans,
		board,
		record: buildRecordModel({ record: status?.sessionRecord ?? { state: "missing" } }),
		history: buildHistoryModel({ events, sessions, focus: followed, projectRoot: status?.projectRoot ?? "", now }),
		tabs: buildTabs({ tree, plans, board, sessions }),
		title: buildDocumentTitle({ project: name, waiting: (status?.waiting.length ?? 0) > 0 }),
	};
}
