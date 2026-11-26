import { readFile } from "node:fs/promises";
import locateBoard from "@/service/observer/kanban/shared/locateBoard/index.js";
import readSessionKanban from "@/service/observer/kanban/shared/readSessionKanban/index.js";
import namesSlug from "@/service/observer/kanban/shared/namesSlug/index.js";
import parseTaskNote from "@/service/observer/kanban/shared/parseTaskNote/index.js";
import findTaskFile from "@/service/observer/kanban/task/read/findTaskFile/index.js";
import type { ReportedLocation, TaskReadResult } from "@/service/observer/kanban/types/index.js";

/**
 * Reads one task's full note from this project's board folder: locates the board from the project's
 * brain config and the reported kanban tag (or the user's kanban folder override), finds the slug's note confined to that board,
 * and returns its text exactly as stored with the parsed task. Unavailable, not-found and refused
 * are results, not throws. Never writes.
 */
export default async function read({
	reported,
	kanbanOverride,
	projectRoot,
	slug,
}: {
	reported: ReportedLocation | null;
	kanbanOverride?: string;
	projectRoot: string;
	slug: string;
}): Promise<TaskReadResult> {
	// 1. Locate the board from the project's brain config and the user's override; a board that cannot be found is the answer as is.
	const board = await locateBoard({ projectRoot, reported, kanbanOverride });
	if (board.state === "unavailable") return board;

	// 2. Find the slug's note inside the board.
	const file = await findTaskFile({ boardFolder: board.boardFolder, slug });
	if (file.state === "not-found") return { state: "not-found", slug };
	if (file.state === "refused") return { state: "refused", slug, detail: file.detail };

	// 3. Read the note's full text.
	let markdown: string;
	try {
		markdown = await readFile(file.path, "utf-8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
		return { state: "refused", slug, detail: `cannot be read: ${code}` };
	}

	// 4. Mark the task when the session record names it, then parse it.
	const sessionKanban = await readSessionKanban({ projectRoot });
	const task = parseTaskNote({
		slug,
		column: file.column,
		markdown,
		inSession: namesSlug({ text: sessionKanban, slug }),
	});

	return { state: "found", slug, column: file.column, markdown, task };
}
