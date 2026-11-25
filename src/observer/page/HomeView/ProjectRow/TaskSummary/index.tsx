import { useState } from "react";
import fetchTask from "@/observer/page/api/fetchTask/index.js";
import BOARD_COLUMNS from "@/service/observer/kanban/shared/columns/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import Markdown from "@/observer/page/shared/Markdown/index.js";
import useFetched from "@/observer/page/shared/useFetched/index.js";
import pickSections from "./pickSections/index.js";

/**
 * The task the project's live session is working on, read when the row expands and disclosed in
 * steps: a `Current task` caption with `Open in project` beside it (the whole note in the
 * project page's Details), the title, the column, priority and type as chips, then the note's own `##` sections
 * (task notes are free-form markdown, so these are whatever headings the note uses) as collapsed lines
 * with a one-line preview; clicking one shows that section in full. Falls back to
 * the reported title alone while the note loads or when it cannot be read.
 */
export default function TaskSummary({
	token,
	projectKey,
	slug,
	title,
	href,
	onOpenHref,
}: {
	token: string;
	projectKey: string;
	slug: string;
	title: string;
	href: string;
	onOpenHref(href: string): void;
}) {
	const note = useFetched({ key: `${projectKey}:${slug}`, load: () => fetchTask({ token, projectKey, slug }) });
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
	const ready = note.state === "ready" ? note.data : null;
	const task = ready !== null && ready.task.state === "readable" ? ready.task : null;
	const column = ready === null ? null : (BOARD_COLUMNS.find((candidate) => candidate.id === ready.column)?.label ?? ready.column);
	const sections = ready === null ? [] : pickSections(ready.markdown);
	const toggle = (heading: string): void => {
		const next = new Set(open);
		if (next.has(heading)) next.delete(heading);
		else next.add(heading);
		setOpen(next);
	};

	return (
		<div className="pm-task">
			<div className="pm-cap-row">
				<span className="pm-cap">Current task</span>
				<button type="button" className="av-linkbtn pm-task-link" onClick={() => onOpenHref(href)}>
					Open in project →
				</button>
			</div>
			<span className="pm-task-t">{task?.title ?? title}</span>
			{(column !== null || task !== null) && (
				<div className="pm-task-chips">
					{column !== null && <span className="av-badge neutral">{column}</span>}
					{task !== null && <span className={`av-badge av-prio ${task.priority}`}>{task.priority}</span>}
					{task?.type !== undefined && <span className="av-badge outline">{task.type}</span>}
				</div>
			)}
			{sections.length > 0 && <span className="pm-cap pm-cap-note">Task note</span>}
			{sections.length > 0 && (
				<div className="pm-secs">
					{sections.map((section) => {
						const isOpen = open.has(section.heading);
						return (
							<div key={section.heading} className={isOpen ? "pm-sec open" : "pm-sec"}>
								<button type="button" className="pm-sec-h" aria-expanded={isOpen} onClick={() => toggle(section.heading)}>
									<Icon name={isOpen ? "chev-d" : "chev-r"} />
									<span className="pm-sec-k">{section.heading}</span>
									{!isOpen && <span className="pm-sec-p">{section.preview}</span>}
								</button>
								{isOpen && (
									<div className="pm-sec-b md-body">
										<Markdown markdown={section.markdown} />
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
