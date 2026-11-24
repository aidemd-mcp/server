import type { ObserverEvent } from "@/types/index.js";
import type { ProjectView } from "@/observer/types/index.js";
import type { BoardModel } from "@/observer/page/types/index.js";
import buildColumn from "./buildColumn/index.js";
import buildUnavailable from "./buildUnavailable/index.js";
import findLinkedSlugs from "./findLinkedSlugs/index.js";

/**
 * The Board tab's model: five columns with their count line when the observer located the board,
 * else the notice for why it did not. A project with no reported root has no board to look for and
 * gets a calm notice; before the first view arrives the notice says so. `focus` is the session whose
 * `task` events outline cards as this session's.
 */
export default function buildBoardModel({ view, events, focus }: { view: ProjectView | null; events: ObserverEvent[]; focus: string }): BoardModel {
	if (view === null) {
		return {
			kind: "unavailable",
			tone: "calm",
			heading: "Board unavailable",
			text: "The observer hasn't sent this project's board yet. It appears as soon as the first status arrives.",
			meta: null,
		};
	}
	if (view.state === "no-project-root") {
		return {
			kind: "unavailable",
			tone: "calm",
			heading: "Board unavailable",
			text: "This project hasn't reported its folder or brain folder, so its kanban board can't be found. Tasks the agent picked still show in History.",
			meta: null,
		};
	}

	const { board, generatedAt } = view.status;
	if (board.state === "unavailable") return buildUnavailable({ board, readAt: generatedAt });

	const linkedSlugs = findLinkedSlugs({ events, focus });
	const columns = board.columns.map((column) => buildColumn({ column, linkedSlugs }));
	const total = columns.reduce((sum, column) => sum + column.total, 0);
	const linked = columns.reduce((sum, column) => sum + column.tasks.filter((task) => task.linked).length, 0);
	return { kind: "board", columns, countLine: `${total} tasks · ${linked} linked to this session` };
}
