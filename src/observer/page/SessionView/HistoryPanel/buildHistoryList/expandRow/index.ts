import type { HistoryRowModel } from "@/observer/page/types/index.js";

/**
 * The lines one row draws: the row, then the group of file writes under it (its `Wrote <n> files`
 * line and a line per path). With `filesOnly` the row itself is left out and only its group draws.
 */
export default function expandRow({ row, filesOnly }: { row: HistoryRowModel; filesOnly: boolean }): HistoryRowModel[] {
	if (row.kind === "files") return [row, ...row.files];
	const group = row.files[0];
	const grouped = group === undefined ? [] : [group, ...group.files];
	return filesOnly ? grouped : [row, ...grouped];
}
