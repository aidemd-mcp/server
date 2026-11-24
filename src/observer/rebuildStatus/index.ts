import readBoard from "@/service/observer/kanban/board/read/index.js";
import { BOARD_HINT } from "@/service/observer/kanban/shared/locateBoard/index.js";
import buildStatus from "@/service/observer/status/index.js";
import type { BoardResult, Status } from "@/types/index.js";
import describeError from "@/util/describeError/index.js";
import pickReportedLocation from "../shared/pickReportedLocation/index.js";
import type { HeldSession } from "../types/index.js";

/**
 * Rebuilds the status from the project's files and every held event. The board read never throws
 * by contract, but if it does only the board part degrades: a thrown read becomes an `unavailable`
 * result with reason `board-read-failed` (the error text kept in `detail`); the rest of the
 * status is still built. A throw from the status builder itself propagates to the caller.
 */
export default async function rebuildStatus({
	projectRoot,
	sessions,
	brainOverride,
}: {
	projectRoot: string;
	sessions: HeldSession[];
	brainOverride?: string;
}): Promise<Status> {
	// 1. Where the newest session says its board lives (the --brain override is applied by kanban).
	const reported = pickReportedLocation({ sessions });

	// 2. Read the board; a throw degrades only the board part.
	let board: BoardResult;
	try {
		board = await readBoard({ reported, brainOverride, projectRoot });
	} catch (error) {
		const message = describeError({ error });
		board = { state: "unavailable", reason: "board-read-failed", detail: `board read failed: ${message}`, hint: BOARD_HINT };
	}

	// 3. Every held event of every session, already deduped by the store.
	const events = sessions.flatMap((session) => session.events);

	// 4. Build and return the status.
	return buildStatus({ projectRoot, events, board });
}
