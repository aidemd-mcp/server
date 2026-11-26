import type { BoardUnavailable } from "@/service/observer/kanban/types/index.js";
import boardHints from "../boardHints/index.js";

/**
 * Builds an unavailable-board answer. Every one, kanban's own and a caller's
 * `board-read-failed`, is built here so reason and hint never drift apart.
 */
export default function boardUnavailable({
	reason,
	detail,
}: Pick<BoardUnavailable, "reason" | "detail">): BoardUnavailable {
	return { state: "unavailable", reason, detail, hint: boardHints[reason] };
}
