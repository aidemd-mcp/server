import { useState } from "react";
import type { BoardColumnId } from "@/types/index.js";
import buildDocumentTitle from "@/observer/page/shared/buildDocumentTitle/index.js";
import InvalidLink from "@/observer/page/shared/InvalidLink/index.js";
import SkipLink from "@/observer/page/shared/SkipLink/index.js";
import useDocumentTitle from "@/observer/page/shared/useDocumentTitle/index.js";
import useNarrow from "@/observer/page/shared/useNarrow/index.js";
import useTick from "@/observer/page/shared/useTick/index.js";
import type { DrawerItem, SessionRoute, SessionTab } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import buildSessionModel from "./buildSessionModel/index.js";
import Drawer from "./Drawer/index.js";
import findStepSource from "./findStepSource/index.js";
import BoardPanel from "./BoardPanel/index.js";
import toggleColumn from "./BoardPanel/toggleColumn/index.js";
import BottomDrawer from "./BottomDrawer/index.js";
import ProjectInfo from "./ProjectInfo/index.js";
import SessionsPanel from "./SessionsPanel/index.js";
import HistoryPanel from "./HistoryPanel/index.js";
import NotInstalled from "./NotInstalled/index.js";
import NowSection from "./NowSection/index.js";
import QuietBanner from "./QuietBanner/index.js";
import RunBar from "./RunBar/index.js";
import SessionHeader from "./SessionHeader/index.js";
import SessionNotFound from "./SessionNotFound/index.js";
import SidePanel from "./SidePanel/index.js";
import TabPanel from "./TabPanel/index.js";
import Tabs from "./Tabs/index.js";
import useElementHeight from "./useElementHeight/index.js";
import useStepText from "./useStepText/index.js";
import WaitBanner from "./WaitBanner/index.js";

/**
 * The session view at `/p/:project/s/:session`: the sticky header, the quiet reconnecting banner
 * (only when it applies), the now section (card, rail, lanes), then the tabbed main area beside the
 * history column. While a gate is open the full-width waiting banner opens the body and sticks under
 * the header, shrinking to one line once stuck. A detail in the link opens the drawer over the right
 * side. Reads the project's stream, ticks each second, and keeps the tab title saying so while a
 * gate is open. The header switcher changes which live session the card and history follow, never
 * the link. A project with no AIDE files gets the install notice in place of the pipeline. Until
 * the stream first answers (`connecting`) nothing is drawn, so a rejected link never shows a pill,
 * rail or data before the invalid-link notice.
 */
export default function SessionView({
	route,
	setTab,
	openItem,
	closeItem,
}: {
	route: SessionRoute;
	setTab(tab: SessionTab): void;
	openItem(item: DrawerItem): void;
	closeItem(): void;
}) {
	const { token, projectKey, sessionId } = route;
	const state = useObserverStream({ token, projectKey });
	useTick(true);
	const narrow = useNarrow();
	const [picked, setPicked] = useState(sessionId);

	const now = new Date();
	const view = state.views[projectKey];
	const stepText = useStepText({
		token,
		projectKey,
		source: findStepSource({
			status: view?.state === "ready" ? view.status : null,
			focus: picked,
		}),
	});
	const model = buildSessionModel({
		state,
		route,
		focus: picked,
		now,
		ui: { stepText },
	});
	useDocumentTitle({
		title: state.connection === "unauthorized" ? buildDocumentTitle({ waiting: false }) : model.title,
	});
	const [top, setTop] = useState<HTMLDivElement | null>(null);
	const [boardColumns, setBoardColumns] = useState<ReadonlySet<BoardColumnId>>(() => new Set());
	const topHeight = useElementHeight(top);

	if (state.connection === "connecting") return null;
	if (state.connection === "unauthorized") return <InvalidLink />;

	const tab = (!narrow && (route.tab === "history" || route.tab === "board" || route.tab === "sessions" || route.tab === "plans")) || route.tab === "record" ? "tree" : route.tab;
	const countOf = (id: string): string | null => model.tabs.find((candidate) => candidate.id === id)?.count ?? null;
	const drawerContext = {
		token,
		projectKey,
		status: model.status,
		events: model.events,
		sessions: model.sessions,
		focus: model.focus,
		now,
	};
	return (
		<>
			<SkipLink target="main" />
			<div className="av-top" ref={setTop}>
				<SessionHeader
					header={model.header}
					conn={model.conn}
					onPickSession={setPicked}
				/>
			</div>
			{model.notFound ? (
				<SessionNotFound />
			) : (
				<div className="av-body">
					{model.waiting !== null && <WaitBanner {...model.waiting} top={topHeight} onOpen={openItem} />}
					{!narrow && model.waiting === null && model.card.kind !== "empty" && model.notInstalled === null && <RunBar card={model.card} />}
					{model.reconnecting && <QuietBanner lastUpdate={model.lastUpdate} />}
					{model.notInstalled !== null ? (
						<NotInstalled
							projectRoot={model.notInstalled.projectRoot}
							sessions={model.sessions}
							now={now}
							token={token}
							projectKey={projectKey}
							routeSessionId={sessionId}
						/>
					) : (
						<>
							<div className="av-main">
								<div className="av-left">
									<main id="main" className="av-primary">
										<NowSection card={model.card} phases={model.phases} lanes={model.lanes} />
										<Tabs tabs={model.tabs} selected={tab} onPick={setTab} />
										<TabPanel tab={tab} model={model} now={now} token={token} projectKey={projectKey} routeSessionId={sessionId} onOpen={openItem} />
									</main>
									{narrow && <HistoryPanel history={model.history} onOpen={openItem} />}
								</div>
								{!narrow && <SidePanel item={route.item} context={drawerContext} />}
							</div>
							{!narrow && (
								<BottomDrawer
											history={model.history}
											counts={{ sessions: String(model.sessions.length), board: countOf("board") }}
											sessions={
												<>
													<ProjectInfo rootPath={model.header.rootPath} kanbanTag={model.header.kanbanTag} />
													<SessionsPanel rows={model.sessions} now={now} token={token} projectKey={projectKey} routeSessionId={sessionId} />
												</>
											}
											board={
												<BoardPanel
													board={model.board}
													expanded={boardColumns}
													onToggle={(column) => setBoardColumns((previous) => toggleColumn({ expanded: previous, column }))}
													onOpen={openItem}
												/>
											}
											onOpen={openItem}
											picker={{ sessions: model.sessions, current: model.focus, now, onPick: setPicked }}
										/>
							)}
						</>
					)}
				</div>
			)}
			{route.item !== null && narrow && !model.notFound && <Drawer item={route.item} context={drawerContext} onClose={closeItem} />}
		</>
	);
}
