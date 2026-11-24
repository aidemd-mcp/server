import { useState } from "react";
import AppHeader from "@/observer/page/shared/AppHeader/index.js";
import Brand from "@/observer/page/shared/Brand/index.js";
import buildDocumentTitle from "@/observer/page/shared/buildDocumentTitle/index.js";
import ConnectionPill from "@/observer/page/shared/ConnectionPill/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import InstallCommand from "@/observer/page/shared/InstallCommand/index.js";
import InvalidLink from "@/observer/page/shared/InvalidLink/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import SkipLink from "@/observer/page/shared/SkipLink/index.js";
import ThemeButton from "@/observer/page/shared/ThemeButton/index.js";
import useDocumentTitle from "@/observer/page/shared/useDocumentTitle/index.js";
import useThemeContext from "@/observer/page/shared/useThemeContext/index.js";
import useTick from "@/observer/page/shared/useTick/index.js";
import removeSession from "@/observer/page/SessionView/removeSession/index.js";
import type { HomeRoute } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import buildHomeModel from "./buildHomeModel/index.js";
import filterProjects from "./filterProjects/index.js";
import LiveRow from "./LiveRow/index.js";
import openSession from "./openSession/index.js";
import ProjectRow from "./ProjectRow/index.js";
import WaitCard from "./WaitCard/index.js";

/**
 * Home at `/`: every project's open gates (amber, first), live sessions, and the projects expandable
 * to their sessions. Reads the all-projects stream, ticks each second so spans stay current, and
 * sets the tab title to say so while a gate is open. Delete is the only write: an ended session asks
 * first, then goes through `removeSession`; the stream's frames take it off the list. Until the
 * stream first answers (`connecting`) nothing is drawn, so a rejected link never shows a pill or
 * data before the invalid-link notice.
 */
export default function HomeView({ route }: { route: HomeRoute }) {
	const { token } = route;
	const state = useObserverStream({ token });
	useTick(true);
	const { theme, toggle } = useThemeContext();
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [query, setQuery] = useState("");
	const [confirming, setConfirming] = useState<{ projectKey: string; sessionId: string } | null>(null);
	const [error, setError] = useState<string | null>(null);

	const now = new Date();
	const model = buildHomeModel({ state, now, token });
	useDocumentTitle({ title: buildDocumentTitle({ waiting: model.waits.length > 0 }) });

	if (state.connection === "connecting") return null;
	if (state.connection === "unauthorized") return <InvalidLink />;

	const open = (href: string) => () => openSession({ href });
	const shown = filterProjects({ projects: model.projects, query });

	return (
		<>
			<SkipLink target="main" />
			<AppHeader
				left={
					<>
						<Brand />
						<div className="av-hdr-meta">{model.subtitle}</div>
					</>
				}
				right={
					<>
						<ConnectionPill state={model.conn} />
						<ThemeButton theme={theme} onToggle={toggle} />
					</>
				}
			/>
			<div className="av-body">
				<main id="main" className="av-home">
					{model.empty && (
						<Notice tone="calm" icon="eye" iconSize="xl" heading="Nothing recorded yet" style={{ marginTop: 24 }}>
							<p>
								Projects appear here as soon as an agent starts a session in a project that has AIDE installed. This page
								updates by itself — no need to refresh.
							</p>
							<p>New to AIDE in a project? Run this in the project&apos;s root, then start a session:</p>
							<InstallCommand />
						</Notice>
					)}

					{model.waits.length > 0 && (
						<section className="av-sect" aria-labelledby="h-wait">
							<h2 className="av-h2" id="h-wait">
								<Icon name="wait" />
								Waiting on you <span className="n">{model.waits.length}</span>
							</h2>
							{model.waits.map((card) => (
								<WaitCard key={card.key} card={card} onOpen={open(card.href)} />
							))}
						</section>
					)}

					{model.live.length > 0 && (
						<section className="av-sect" aria-labelledby="h-live">
							<h2 className="av-h2" id="h-live">
								<Icon name="run" style={{ color: "var(--run)" }} />
								Live sessions <span className="n">{model.live.length}</span>
							</h2>
							<div className="av-list">
								{model.live.map((row) => (
									<LiveRow key={row.key} row={row} onOpen={open(row.href)} />
								))}
							</div>
						</section>
					)}

					{model.projects.length > 0 && (
						<section className="av-sect" aria-labelledby="h-proj">
							<div className="row wrap" style={{ justifyContent: "space-between", gap: 12 }}>
								<h2 className="av-h2" id="h-proj">
									<Icon name="folder" />
									Projects <span className="n">{model.projects.length}</span>
								</h2>
								{model.filterable && (
									<label className="av-field" style={{ flex: "0 1 300px" }}>
										<Icon name="search" />
										<span className="sr">Filter projects</span>
										<input type="search" placeholder="Filter projects" value={query} onChange={(event) => setQuery(event.target.value)} />
									</label>
								)}
							</div>
							<div className="av-list">
								{shown.map((project) => (
									<ProjectRow
										key={project.projectKey}
										project={project}
										open={expanded[project.projectKey] === true}
										now={now}
										confirmingId={confirming?.projectKey === project.projectKey ? confirming.sessionId : null}
										error={error}
										onToggle={() => setExpanded({ ...expanded, [project.projectKey]: expanded[project.projectKey] !== true })}
										onOpen={() => {
											if (project.openHref !== null) openSession({ href: project.openHref });
										}}
										onAskDelete={(sessionId) => {
											setError(null);
											setConfirming({ projectKey: project.projectKey, sessionId });
										}}
										onCancel={() => setConfirming(null)}
										onDelete={async (sessionId) => {
											const message = await removeSession({ token, projectKey: project.projectKey, sessionId });
											setError(message);
											if (message === null) setConfirming(null);
										}}
									/>
								))}
							</div>
						</section>
					)}
				</main>
			</div>
		</>
	);
}
