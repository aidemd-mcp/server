import { isAbsolute, join } from "node:path";
import { stat } from "node:fs/promises";
import type { BoardUnavailable, ReportedLocation } from "@/service/observer/kanban/types/index.js";
import boardUnavailable from "../boardUnavailable/index.js";
import readKanbanFolder from "./readKanbanFolder/index.js";

/** A single safe folder or file-name segment: no separators, no leading dot, bounded length. */
export const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** Where the board was found: its folder and the kanban tag it belongs to. */
type LocatedBoard = { state: "located"; boardFolder: string; kanbanTag: string };

/** True when the path exists and is a directory; any fs error counts as no. */
async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

/**
 * Locates the project's board folder: the kanban folder comes from the kanban
 * field of the project's brain config at the project root, the tag comes from
 * what the newest session reported, and the board is the tag's folder inside the
 * kanban folder. `kanbanOverride` replaces the kanban folder for this project
 * only (the brain config is then not read at all); the tag always comes from the
 * session. Never reads the launcher or a brain folder a session reported, reads
 * nothing but the config and folder metadata, and never throws: every failure is
 * an unavailable result naming what was checked.
 */
export default async function locateBoard({
	projectRoot,
	reported,
	kanbanOverride,
}: {
	projectRoot: string;
	reported: ReportedLocation | null;
	kanbanOverride?: string;
}): Promise<LocatedBoard | BoardUnavailable> {
	// 1. The kanban folder: the user's override, else the project's brain config.
	let kanbanFolder: string;
	if (kanbanOverride) {
		kanbanFolder = kanbanOverride;
	} else {
		const configured = await readKanbanFolder({ projectRoot });
		if (configured.state === "unavailable") return configured;
		kanbanFolder = configured.kanbanFolder;
	}

	// 2. The tag the newest session reported.
	const kanbanTag = reported?.kanbanTag;
	if (!kanbanTag) {
		return boardUnavailable({
			reason: "no-kanban-tag",
			detail: "no session has reported a kanban tag",
		});
	}

	// 3. The kanban folder must be an absolute path to a folder that exists.
	const origin = kanbanOverride ? " (the kanban folder the view command was given)" : "";
	if (!isAbsolute(kanbanFolder)) {
		return boardUnavailable({
			reason: "kanban-folder-missing",
			detail: `${kanbanFolder} is not an absolute path${origin}`,
		});
	}

	if (!(await isDirectory(kanbanFolder))) {
		return boardUnavailable({
			reason: "kanban-folder-missing",
			detail: `${kanbanFolder} is not a folder that exists${origin}`,
		});
	}

	// 4. The tag becomes a folder name, so it must be one plain segment that cannot climb out of the kanban folder.
	if (!SEGMENT_PATTERN.test(kanbanTag) || kanbanTag.includes("..")) {
		return boardUnavailable({
			reason: "board-folder-missing",
			detail: `${kanbanTag} is not a single folder name`,
		});
	}

	// 5. The board is the tag's folder inside the kanban folder.
	const boardFolder = join(kanbanFolder, kanbanTag);
	if (!(await isDirectory(boardFolder))) {
		return boardUnavailable({
			reason: "board-folder-missing",
			detail: `${boardFolder} is not a folder that exists`,
		});
	}

	return { state: "located", boardFolder, kanbanTag };
}
