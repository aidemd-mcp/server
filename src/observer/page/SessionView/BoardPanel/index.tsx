import type { BoardColumnId } from "@/types/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import type { BoardModel, DrawerItem } from "@/observer/page/types/index.js";
import BoardColumn from "./BoardColumn/index.js";

/**
 * The Board tab: a toolbar naming the outline and the count line over the five columns, or the one
 * notice that says why there is no board. A failed board shows its reason here only (`role=status`),
 * a board that was never located a calm notice. Which columns show every task is the caller's
 * (`expanded`, `onToggle`), so it survives a trip to another tab.
 */
export default function BoardPanel({
	board,
	expanded,
	onToggle,
	onOpen,
}: {
	board: BoardModel;
	expanded: ReadonlySet<BoardColumnId>;
	onToggle(column: BoardColumnId): void;
	onOpen(item: DrawerItem): void;
}) {
	if (board.kind === "unavailable") {
		const err = board.tone === "err";
		return (
			<Notice tone={board.tone} icon={err ? "cloud-off" : "folder-off"} iconSize="lg" heading={board.heading} role={err ? "status" : undefined}>
				<p>{board.text}</p>
				{board.meta !== null && <p className="meta">{board.meta}</p>}
			</Notice>
		);
	}

	return (
		<>
			<div className="av-toolbar">
				<span className="t2">Tasks linked to this session are outlined.</span>
				<span className="count">{board.countLine}</span>
			</div>
			<div className="av-board">
				{board.columns.map((column) => (
					<BoardColumn
						key={column.id}
						column={column}
						expanded={expanded.has(column.id)}
						onToggle={() => onToggle(column.id)}
						onOpen={(slug) => onOpen({ kind: "task", slug })}
					/>
				))}
			</div>
		</>
	);
}
