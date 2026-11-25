import { useRef, useState } from "react";
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
import type { HomeRoute } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import buildHomeModel from "./buildHomeModel/index.js";
import filterProjects from "./filterProjects/index.js";
import openSession from "./openSession/index.js";
import ProjectRow from "./ProjectRow/index.js";
import WaitFab from "./WaitFab/index.js";
import sortProjects from "./sortProjects/index.js";
import useCustomOrder from "./useCustomOrder/index.js";
import useFlip from "./useFlip/index.js";
import useStableOrder from "./useStableOrder/index.js";
import useStarred from "./useStarred/index.js";
import type { ProjectRowModel } from "@/observer/page/types/index.js";

/**
 * Home at `/`: the projects, starred ones (this browser's choice) in their own section above the rest,
 * each section ordered by activity (waiting, running, newest event; re-ordering with a
 * short slide) or in the viewer's own dragged order, with a floating amber button listing every open gate while any is open, each showing what its
 * live session is doing now and one click into its project page (sessions and their archive live there). Reads the all-projects
 * stream, ticks each second so spans stay current, and sets the tab title to say so while a gate is
 * open. Until the
 * stream first answers (`connecting`) nothing is drawn, so a rejected link never shows a pill or
 * data before the invalid-link notice.
 */
export default function HomeView({ route }: { route: HomeRoute }) {
	const { token } = route;
	const state = useObserverStream({ token });
	useTick(true);
	const { theme, toggle } = useThemeContext();
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const { order, setOrder, custom, move } = useCustomOrder();
	const [dragging, setDragging] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const { starred, setStarred } = useStarred();
	const [query, setQuery] = useState("");

	const now = new Date();
	const model = buildHomeModel({ state, now, token });
	useDocumentTitle({ title: buildDocumentTitle({ waiting: model.waits.length > 0 }) });
	const activityKeys = sortProjects({ projects: model.projects, order: "activity", custom: [] }).map((project) => project.projectKey);
	const ready = model.projects.length > 0 && model.projects.every((project) => state.views[project.projectKey] !== undefined);
	const stable = useStableOrder({ wanted: activityKeys, ready });
	const displayKeys = order === "custom" ? sortProjects({ projects: model.projects, order, custom }).map((project) => project.projectKey) : stable.order;
	useFlip({ container: listRef, orderKey: displayKeys.join("|"), enabled: order === "custom" || stable.settled });

	if (state.connection === "connecting") return null;
	if (state.connection === "unauthorized") return <InvalidLink />;

	const open = (href: string) => () => openSession({ href });
	const filtered = filterProjects({ projects: model.projects, query });
	const rank = new Map(displayKeys.map((key, index) => [key, index]));
	const shown = [...filtered].sort((a, b) => (rank.get(a.projectKey) ?? displayKeys.length) - (rank.get(b.projectKey) ?? displayKeys.length));
	const starredRows = shown.filter((project) => starred.has(project.projectKey));
	const otherRows = shown.filter((project) => !starred.has(project.projectKey));
	const renderRow = (project: ProjectRowModel) => (
		<ProjectRow
			key={project.projectKey}
			project={project}
			open={expanded[project.projectKey] === true}
			token={token}
			starred={starred.has(project.projectKey)}
			onStar={(on) => setStarred(project.projectKey, on)}
			drag={
				order === "custom"
					? {
							onDragStart: () => setDragging(project.projectKey),
							onDrop: () => {
								if (dragging !== null) {
									const target = starred.has(project.projectKey);
									if (starred.has(dragging) !== target) setStarred(dragging, target);
									move({ from: dragging, to: project.projectKey, current: shown.map((candidate) => candidate.projectKey) });
								}
								setDragging(null);
							},
						}
					: null
			}
			onToggle={() => setExpanded({ ...expanded, [project.projectKey]: expanded[project.projectKey] !== true })}
			onOpenHref={(href) => openSession({ href })}
			onOpen={() => {
				if (project.openHref !== null) openSession({ href: project.openHref });
			}}
		/>
	);

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


					{model.projects.length > 0 && (
						<section className="av-sect" aria-labelledby="h-proj">
							<div className="row wrap" style={{ justifyContent: "space-between", gap: 12 }}>
								<h2 className="av-h2" id="h-proj">
									<Icon name="folder" />
									Projects <span className="n">{model.projects.length}</span>
								</h2>
								<div className="av-seg av-order" role="group" aria-label="Order projects by">
									<button type="button" aria-pressed={order === "activity"} onClick={() => setOrder("activity")}>
										Activity
									</button>
									<button type="button" aria-pressed={order === "custom"} onClick={() => setOrder("custom")} title="Drag projects to reorder">
										Custom
									</button>
								</div>
								{model.filterable && (
									<label className="av-field" style={{ flex: "0 1 300px" }}>
										<Icon name="search" />
										<span className="sr">Filter projects</span>
										<input type="search" placeholder="Filter projects" value={query} onChange={(event) => setQuery(event.target.value)} />
									</label>
								)}
							</div>
							<div ref={listRef} className="av-proj-groups">
								{starredRows.length > 0 && (
									<>
										<h3 className="av-proj-group-h">
											★ Starred <span className="n">{starredRows.length}</span>
										</h3>
										<div className="av-list">{starredRows.map(renderRow)}</div>
										<h3 className="av-proj-group-h">
											All projects <span className="n">{otherRows.length}</span>
										</h3>
									</>
								)}
								{otherRows.length > 0 && <div className="av-list">{otherRows.map(renderRow)}</div>}
							</div>
						</section>
					)}
				</main>
				<WaitFab cards={model.waits} onOpen={(href) => openSession({ href })} />
			</div>
		</>
	);
}
