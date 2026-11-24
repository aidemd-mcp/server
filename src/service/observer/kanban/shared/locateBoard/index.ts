import { isAbsolute, join } from "node:path";
import { stat } from "node:fs/promises";
import type { BoardUnavailable, ReportedLocation } from "@/service/observer/kanban/types/index.js";

/** The folder inside the brain that holds every project's board. */
const KANBAN_FOLDER = "kanban";

/** What the user can do about any unavailable board: tell the observer which brain folder to use. */
export const BOARD_HINT = "The board comes from the kanban tag and brain folder the agent reports at session start (the instructions file's `Kanban project tag:` line and the brain's folder). To override the brain folder, stop the running observer and start it from the project's folder with: aidemd-mcp view --brain <path>";

/** A single safe folder or file-name segment: no separators, no leading dot, bounded length. */
export const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** Where the board was found: its folder and the kanban tag it belongs to. */
type LocatedBoard = { state: "located"; boardFolder: string; kanbanTag: string };

/** Builds the unavailable answer, always carrying the shared hint. */
function unavailable({
	reason,
	detail,
}: Pick<BoardUnavailable, "reason" | "detail">): BoardUnavailable {
	return { state: "unavailable", reason, detail, hint: BOARD_HINT };
}

/** True when the path exists and is a directory; any fs error counts as no. */
async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

/**
 * Locates the project's board folder from what the newest session reported
 * (brain path and kanban tag) and the user's `--brain` override. The override
 * replaces the brain folder only; the tag always comes from the session.
 * Reads nothing but folder metadata, never throws: every failure is an
 * unavailable result naming what was checked.
 */
export default async function locateBoard({
	reported,
	brainOverride,
}: {
	reported: ReportedLocation | null;
	brainOverride?: string;
}): Promise<LocatedBoard | BoardUnavailable> {
	const brainPath = brainOverride ? brainOverride : reported?.brainPath;
	if (!brainPath) {
		return unavailable({
			reason: "no-brain-path",
			detail: "no session has reported a brain folder",
		});
	}

	const kanbanTag = reported?.kanbanTag;
	if (!kanbanTag) {
		return unavailable({
			reason: "no-kanban-tag",
			detail: "no session has reported a kanban tag",
		});
	}

	if (!isAbsolute(brainPath)) {
		return unavailable({
			reason: "brain-path-missing",
			detail: `${brainPath} is not an absolute path`,
		});
	}

	if (!(await isDirectory(brainPath))) {
		return unavailable({
			reason: "brain-path-missing",
			detail: `${brainPath} is not a folder that exists`,
		});
	}

	// The tag becomes a folder name, so it must be one plain segment that cannot climb out of kanban/.
	if (!SEGMENT_PATTERN.test(kanbanTag) || kanbanTag.includes("..")) {
		return unavailable({
			reason: "board-folder-missing",
			detail: `${kanbanTag} is not a single folder name`,
		});
	}

	const boardFolder = join(brainPath, KANBAN_FOLDER, kanbanTag);
	if (!(await isDirectory(boardFolder))) {
		return unavailable({
			reason: "board-folder-missing",
			detail: `${boardFolder} is not a folder that exists`,
		});
	}

	return { state: "located", boardFolder, kanbanTag };
}
