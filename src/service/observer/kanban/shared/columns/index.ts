import type { BoardColumn, BoardColumnId } from "@/service/observer/kanban/types/index.js";

/** The board's five columns in display order. `archive/` is deliberately absent: it is not a board column. */
const BOARD_COLUMNS = [
	{ id: "backlog", label: "Backlog" },
	{ id: "todo", label: "Todo" },
	{ id: "in-progress", label: "In Progress" },
	{ id: "in-review", label: "In Review" },
	{ id: "done", label: "Done" },
] as const satisfies readonly { id: BoardColumnId; label: BoardColumn["label"] }[];

export default BOARD_COLUMNS;
