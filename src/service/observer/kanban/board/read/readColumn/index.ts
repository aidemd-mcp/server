import { join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import isInsideFolder from "@/service/observer/kanban/shared/isInsideFolder/index.js";
import namesSlug from "@/service/observer/kanban/shared/namesSlug/index.js";
import parseTaskNote from "@/service/observer/kanban/shared/parseTaskNote/index.js";
import type { BoardColumnId, BoardTask } from "@/service/observer/kanban/types/index.js";

/** The extension every task note carries. */
const NOTE_EXTENSION = ".md";

/** Sort rank of a task: p0 first, unreadable notes after p3. */
function rankOf(task: BoardTask): number {
	return task.state === "readable" ? Number(task.priority.slice(1)) : 4;
}

/** The `updated` stamp of a task, "" when it has none (unreadable notes and notes without one). */
function updatedOf(task: BoardTask): string {
	return task.state === "readable" ? (task.updated ?? "") : "";
}

/** Orders tasks by priority, then newest `updated` first (missing last), then slug. */
function compareTasks(left: BoardTask, right: BoardTask): number {
	const byRank = rankOf(left) - rankOf(right);
	if (byRank !== 0) return byRank;

	const leftUpdated = updatedOf(left);
	const rightUpdated = updatedOf(right);
	if (leftUpdated !== rightUpdated) {
		if (leftUpdated === "") return 1;
		if (rightUpdated === "") return -1;
		return leftUpdated < rightUpdated ? 1 : -1;
	}
	return left.slug.localeCompare(right.slug);
}

/** Reads one note into a task; a note that escapes the board or cannot be read is unreadable, never dropped. */
async function readNote({
	boardFolder,
	column,
	slug,
	sessionKanban,
}: {
	boardFolder: string;
	column: BoardColumnId;
	slug: string;
	sessionKanban: string;
}): Promise<BoardTask> {
	const inSession = namesSlug({ text: sessionKanban, slug });
	const path = join(boardFolder, column, `${slug}${NOTE_EXTENSION}`);

	if (!(await isInsideFolder({ folder: boardFolder, path }))) {
		return { state: "unreadable", slug, column, reason: "note resolves outside the board", inSession };
	}

	let markdown: string;
	try {
		markdown = await readFile(path, "utf-8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code ?? "unknown";
		return { state: "unreadable", slug, column, reason: `cannot be read: ${code}`, inSession };
	}
	return parseTaskNote({ slug, column, markdown, inSession });
}

/**
 * Reads every task note in one column folder of the board. A missing or unlistable column folder is
 * an empty column, not an unavailable board: the failure cannot be attributed to one task.
 * Sub-folders and non-`.md` files are ignored. Read-only.
 */
export default async function readColumn({
	boardFolder,
	column,
	sessionKanban,
}: {
	boardFolder: string;
	column: BoardColumnId;
	sessionKanban: string;
}): Promise<BoardTask[]> {
	let entries;
	try {
		entries = await readdir(join(boardFolder, column), { withFileTypes: true });
	} catch {
		return [];
	}

	const slugs = entries
		.filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith(NOTE_EXTENSION))
		.map((entry) => entry.name.slice(0, -NOTE_EXTENSION.length));

	const tasks = await Promise.all(slugs.map((slug) => readNote({ boardFolder, column, slug, sessionKanban })));
	return tasks.sort(compareTasks);
}
