import type { BoardUnavailable } from "@/types/index.js";
import type { BoardModel } from "@/observer/page/types/index.js";
import formatLastTry from "@/observer/page/SessionView/buildBoardModel/formatLastTry/index.js";

/** The observer's detail as a sentence: first letter capitalised, one full stop. */
function toSentence({ detail }: { detail: string }): string {
	const sentence = detail.charAt(0).toUpperCase() + detail.slice(1);
	return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

/**
 * Why the board is not drawn, from what the observer reported. A kanban folder that does not exist
 * (`kanban-folder-missing`) or a read that threw (`board-read-failed`) is the error notice, with the
 * observer's detail and the time of its last read; every other reason is calm, carrying the
 * observer's detail and the reason's own hint. There is no retry timer: the observer reads again on every new event and page load.
 */
export default function buildUnavailable({ board, readAt }: { board: BoardUnavailable; readAt: string }): Extract<BoardModel, { kind: "unavailable" }> {
	if (board.reason === "kanban-folder-missing" || board.reason === "board-read-failed") {
		return {
			kind: "unavailable",
			tone: "err",
			heading: "Board can't load right now",
			text: `The kanban folder isn't reachable (${board.detail}). Everything else on this page is live.`,
			meta: `Read again on every new event and page load · last try ${formatLastTry({ iso: readAt })}`,
		};
	}
	return { kind: "unavailable", tone: "calm", heading: "Board unavailable", text: `${toSentence({ detail: board.detail })} ${board.hint}`, meta: null };
}
