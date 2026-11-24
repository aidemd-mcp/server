import { useState } from "react";
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
import HistoryPanel from "./HistoryPanel/index.js";
import NotInstalled from "./NotInstalled/index.js";
import NowSection from "./NowSection/index.js";
import QuietBanner from "./QuietBanner/index.js";
import SessionHeader from "./SessionHeader/index.js";
import SessionNotFound from "./SessionNotFound/index.js";
import TabPanel from "./TabPanel/index.js";
import Tabs from "./Tabs/index.js";
import useStepText from "./useStepText/index.js";
import useSurfacedDrawer from "./useSurfacedDrawer/index.js";
import WaitBanner from "./WaitBanner/index.js";

/**
 * The session view at `/p/:project/s/:session`: header, the amber waiting banner and the quiet
 * reconnecting banner (each only when it applies), the now section (card, rail, lanes), then the
 * tabbed main area beside the history column. A detail in the link opens the drawer over the right
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
		source: findStepSource({ status: view?.state === "ready" ? view.status : null, focus: picked }),
	});
	const model = buildSessionModel({ state, route, focus: picked, now, ui: { stepText } });
	useDocumentTitle({ title: state.connection === "unauthorized" ? buildDocumentTitle({ waiting: false }) : model.title });
	useSurfacedDrawer({ surfaced: model.surfaced, holdFirst: route.item !== null, onOpen: openItem });

	if (state.connection === "connecting") return null;
	if (state.connection === "unauthorized") return <InvalidLink />;

	const tab = route.tab === "history" && !narrow ? "tree" : route.tab;
	return (
		<>
			<SkipLink target="main" />
			<SessionHeader header={model.header} conn={model.conn} onPickSession={setPicked} />
			{model.notFound ? (
				<SessionNotFound />
			) : (
				<div className="av-body">
					{model.waiting !== null && <WaitBanner {...model.waiting} />}
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
							<NowSection card={model.card} phases={model.phases} lanes={model.lanes} />
							<div className="av-main">
								<main id="main" className="av-primary">
									<Tabs tabs={model.tabs} selected={tab} onPick={setTab} />
									<TabPanel tab={tab} model={model} now={now} token={token} projectKey={projectKey} routeSessionId={sessionId} onOpen={openItem} />
								</main>
								<HistoryPanel history={model.history} onOpen={openItem} />
							</div>
						</>
					)}
				</div>
			)}
			{route.item !== null && !model.notFound && (
				<Drawer
					item={route.item}
					context={{ token, projectKey, status: model.status, events: model.events, sessions: model.sessions, focus: model.focus, now }}
					onClose={closeItem}
				/>
			)}
		</>
	);
}
