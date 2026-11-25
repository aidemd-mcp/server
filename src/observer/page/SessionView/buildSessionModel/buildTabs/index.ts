import type { BoardModel, PlanRowModel, SessionRowModel, TabModel, TreePanelModel } from "@/observer/page/types/index.js";

/** The Board tab's figure: every task across the columns, `offline` when the board failed to load, none when it was never located. */
function boardCount({ board }: { board: BoardModel }): Pick<TabModel, "count" | "tone"> {
	if (board.kind === "board") return { count: String(board.columns.reduce((sum, column) => sum + column.total, 0)), tone: "default" };
	return board.tone === "err" ? { count: "offline", tone: "danger" } : { count: null, tone: "default" };
}

/**
 * The six tabs in the handoff's order with their counts: misaligned modules (danger) on the tree,
 * plan and todo rows, every board task or `offline`, the project's sessions. A project that never
 * reported its folder shows no count on the three tabs that read it. Board, Sessions and History are
 * phone-only tabs: on desktop they live in the bottom drawer.
 */
export default function buildTabs({
	tree,
	plans,
	board,
	sessions,
}: {
	tree: TreePanelModel;
	plans: PlanRowModel[] | null;
	board: BoardModel;
	sessions: SessionRowModel[];
}): TabModel[] {
	const misaligned = tree.kind === "tree" ? tree.counts.misaligned : 0;
	return [
		{
			id: "tree",
			label: "Intent tree",
			icon: "tree",
			count: misaligned > 0 ? `${misaligned} misaligned` : null,
			tone: "danger",
			phoneOnly: false,
		},
		{ id: "plans", label: "Plans & todos", icon: "step", count: plans === null ? null : String(plans.length), tone: "default", phoneOnly: true },
		{ id: "board", label: "Board", icon: "board", ...boardCount({ board }), phoneOnly: true },
		{ id: "sessions", label: "Sessions", icon: "sessions", count: String(sessions.length), tone: "default", phoneOnly: true },
		{ id: "history", label: "History", icon: "history", count: null, tone: "default", phoneOnly: true },
	];
}
