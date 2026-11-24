import BOARD_COLUMNS from "@/service/observer/kanban/shared/columns/index.js";
import locateBoard from "@/service/observer/kanban/shared/locateBoard/index.js";
import readSessionKanban from "@/service/observer/kanban/shared/readSessionKanban/index.js";
import readColumn from "@/service/observer/kanban/board/read/readColumn/index.js";
import type { BoardResult, ReportedLocation } from "@/service/observer/kanban/types/index.js";

/**
 * Reads the project's kanban board for the observer: the five columns in order, each task with its
 * title, slug, priority, type and tags, marked when the session record names it and marked
 * unreadable when its note cannot be parsed. Answers `unavailable` (reason and hint) when the board
 * cannot be located. Never throws; never writes.
 */
export default async function read({
	reported,
	brainOverride,
	projectRoot,
}: {
	reported: ReportedLocation | null;
	brainOverride?: string;
	projectRoot: string;
}): Promise<BoardResult> {
	// 1. Locate the board from what the session reported and the user's override; stop when it is missing.
	const located = await locateBoard({ reported, brainOverride });
	if (located.state === "unavailable") return located;

	// 2. The session record's Kanban section says which tasks the session touched.
	const sessionKanban = await readSessionKanban({ projectRoot });

	// 3. Read each column in board order.
	const columns = await Promise.all(
		BOARD_COLUMNS.map(async ({ id, label }) => ({
			id,
			label,
			tasks: await readColumn({ boardFolder: located.boardFolder, column: id, sessionKanban }),
		})),
	);

	// 4. Hand the board back.
	return { state: "available", kanbanTag: located.kanbanTag, boardFolder: located.boardFolder, columns };
}
