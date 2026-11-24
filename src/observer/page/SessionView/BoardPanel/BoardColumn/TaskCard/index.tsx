import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { TaskCardModel } from "@/observer/page/types/index.js";

/** The handoff's inline alignment of the `This session` badge inside the card's column. */
const LINKED_BADGE_STYLE = { alignSelf: "flex-start" };

/**
 * One kanban task as a button that opens its detail: the `This session` badge (outlined card) when
 * the session picked it, the title, the slug in mono, then the priority and type as words. An
 * unreadable note shows an `Unreadable` badge instead, and the observer's reason is the slug line's
 * title attribute.
 */
export default function TaskCard({ task, onOpen }: { task: TaskCardModel; onOpen(): void }) {
	return (
		<button type="button" className={joinClasses("av-task", task.linked && "linked")} onClick={onOpen}>
			{task.linked && (
				<span className="av-badge run" style={LINKED_BADGE_STYLE}>
					<Icon name="eye" />
					This session
				</span>
			)}
			<span className="t-title">{task.title}</span>
			<span className="t-slug" title={task.unreadable ?? undefined}>
				{task.slug}
			</span>
			<span className="t-tags">
				{task.unreadable !== null && (
					<span className="av-badge danger">
						<Icon name="error" />
						Unreadable
					</span>
				)}
				{task.priority !== null && <span className={`av-badge av-prio ${task.priority}`}>{task.priority}</span>}
				{task.type !== null && <span className="av-badge neutral">{task.type}</span>}
			</span>
		</button>
	);
}
