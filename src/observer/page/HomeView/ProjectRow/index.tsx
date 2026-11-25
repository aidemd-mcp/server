import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { ProjectRowModel } from "@/observer/page/types/index.js";
import PhaseRail from "@/observer/page/SessionView/PhaseRail/index.js";
import TaskSummary from "./TaskSummary/index.js";

/**
 * One project on Home, with a star that moves it to the Starred section. Closed: the name and live count with the current task's title under it, a short status (the phase badge and its
 * elapsed time, or waiting on you, or no phase running), the last activity and an
 * `Open project` button that goes to the project page. Clicking anywhere else expands the row: the
 * task the live session is working on (title, chips, the note's first paragraph and a link to the
 * whole note) and its phase rail. The row
 * turns amber while a gate is open in the project.
 */
export default function ProjectRow({
	project,
	open,
	token,
	starred,
	onStar,
	drag,
	onToggle,
	onOpen,
	onOpenHref,
}: {
	project: ProjectRowModel;
	open: boolean;
	token: string;
	/** Whether the viewer starred this project, and how to change it. */
	starred: boolean;
	onStar(on: boolean): void;
	/** Set in custom order: the row can be dragged by its grip and dropped on another row. */
	drag: { onDragStart(): void; onDrop(): void } | null;
	onToggle(): void;
	onOpen(): void;
	onOpenHref(href: string): void;
}) {
	const status = project.status ?? null;
	return (
		<div
			className={joinClasses("av-proj", "home", project.waiting && "waiting", open && "open", drag !== null && "draggable")}
			data-flip={project.projectKey}
			draggable={drag !== null}
			onDragStart={drag === null ? undefined : (event) => {
				event.dataTransfer.effectAllowed = "move";
				drag.onDragStart();
			}}
			onDragOver={drag === null ? undefined : (event) => event.preventDefault()}
			onDrop={drag === null ? undefined : (event) => {
				event.preventDefault();
				drag.onDrop();
			}}
		>
			<div className="av-proj-top">
				{drag !== null && (
					<span className="p-grip" title="Drag to reorder" aria-hidden="true">
						⋮⋮
					</span>
				)}
				<button
					type="button"
					className={starred ? "p-star on" : "p-star"}
					aria-pressed={starred}
					aria-label={starred ? `Unstar ${project.name}` : `Star ${project.name}`}
					title={starred ? "Unstar" : "Star"}
					onClick={() => onStar(!starred)}
				>
					{starred ? "★" : "☆"}
				</button>
				<button type="button" className="av-proj-h flat" aria-expanded={open} onClick={onToggle}>
					<Icon name={open ? "chev-d" : "chev-r"} />
					<span className="p-namecol">
						<span className="p-name">
							{project.name}
							{project.liveCount > 0 && (
								<span className="av-badge run">
									<Icon name="run" />
									{project.liveCount} live
								</span>
							)}
						</span>
						{project.task != null && <span className="p-task">{project.task}</span>}
					</span>
					<span className="p-now">
						{status !== null && (
							<>
								<span className={`av-badge ${status.badge.className}`}>
									<Icon name={status.badge.icon} />
									{status.badge.word}
								</span>
								{status.elapsed !== null && <span className="p-el mono">{status.elapsed}</span>}
							</>
						)}
					</span>
					<span className="p-last">{project.lastActivity}</span>
				</button>
				<button type="button" className="av-btn p-open" disabled={project.openHref === null} onClick={onOpen}>
					Open project
					<Icon name="chev-r" />
				</button>
			</div>
			{open && (
				<div className="av-proj-more">
					{project.task != null && project.taskSlug != null && project.taskHref != null ? (
						<TaskSummary token={token} projectKey={project.projectKey} slug={project.taskSlug} title={project.task} href={project.taskHref} onOpenHref={onOpenHref} />
					) : (
						<p className="t3">No task reported by this session.</p>
					)}
					{project.rail != null && project.rail.length > 0 ? (
						<div className="pm-rail">
							<PhaseRail phases={project.rail} />
						</div>
					) : (
						<p className="t3">No session is running in this project.</p>
					)}
				</div>
			)}
		</div>
	);
}
