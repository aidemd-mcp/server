import type { BoardColumnModel } from "@/observer/page/types/index.js";
import TaskCard from "./TaskCard/index.js";

/**
 * One board column: its name and total, the tasks up to its cap (all of them once `expanded`), and
 * a line under them saying what is hidden with a button to show it. Done keeps its wording
 * (`Showing the 5 most recent of 128` / `Show all 128`, then `Showing loaded 128 of 128` / `Show
 * recent only`); every other column says `<n> more in <Column>` and has no way back once expanded.
 */
export default function BoardColumn({
	column,
	expanded,
	onToggle,
	onOpen,
}: {
	column: BoardColumnModel;
	expanded: boolean;
	onToggle(): void;
	onOpen(slug: string): void;
}) {
	const shown = expanded ? column.tasks : column.tasks.slice(0, column.cap);
	const hidden = column.total - shown.length;
	const done = column.id === "done";

	return (
		<section className="av-col" aria-label={column.name}>
			<div className="av-col-h">
				<span>{column.name}</span>
				<span className="n">{column.total}</span>
			</div>
			{shown.map((task) => (
				<TaskCard key={task.slug} task={task} onOpen={() => onOpen(task.slug)} />
			))}
			{done && column.total > column.cap && (
				<div className="more">
					<span>{expanded ? `Showing loaded ${shown.length} of ${column.total}` : `Showing the ${column.cap} most recent of ${column.total}`}</span>
					<button type="button" className="av-btn ghost" onClick={onToggle}>
						{expanded ? "Show recent only" : `Show all ${column.total}`}
					</button>
				</div>
			)}
			{!done && hidden > 0 && (
				<div className="more">
					<span>{`${hidden} more in ${column.name}`}</span>
					<button type="button" className="av-btn ghost" onClick={onToggle}>
						{`Show all ${column.total}`}
					</button>
				</div>
			)}
		</section>
	);
}
