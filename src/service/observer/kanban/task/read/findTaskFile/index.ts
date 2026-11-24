import { join } from "node:path";
import { stat } from "node:fs/promises";
import BOARD_COLUMNS from "@/service/observer/kanban/shared/columns/index.js";
import isInsideFolder from "@/service/observer/kanban/shared/isInsideFolder/index.js";
import { SEGMENT_PATTERN } from "@/service/observer/kanban/shared/locateBoard/index.js";
import type { BoardColumnId } from "@/service/observer/kanban/types/index.js";

/** Where a slug's note was found, or why it was not. */
type FoundTaskFile =
	| { state: "found"; column: BoardColumnId; path: string }
	| { state: "not-found" }
	| { state: "refused"; detail: string };

/** True when the path exists and is a file; any fs error counts as no. */
async function isFile(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

/**
 * Finds the note for a slug inside this project's board folder, searching the five column folders in
 * board order (never `archive/`). The slug must be one safe file-name segment and the note's real path
 * must lie inside the board, so neither `../` slugs nor symlinks can lead outside it. Never throws.
 */
export default async function findTaskFile({
	boardFolder,
	slug,
}: {
	boardFolder: string;
	slug: string;
}): Promise<FoundTaskFile> {
	if (!SEGMENT_PATTERN.test(slug) || slug.includes("..")) {
		return { state: "refused", detail: `${slug} is not a single task name` };
	}

	for (const { id } of BOARD_COLUMNS) {
		const candidate = join(boardFolder, id, `${slug}.md`);
		if (!(await isFile(candidate))) continue;
		if (!(await isInsideFolder({ folder: boardFolder, path: candidate }))) {
			return { state: "refused", detail: "note resolves outside the board" };
		}
		return { state: "found", column: id, path: candidate };
	}

	return { state: "not-found" };
}
