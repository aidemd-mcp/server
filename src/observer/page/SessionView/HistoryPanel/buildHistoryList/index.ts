import type { HistoryListItem, HistoryRowModel, HistoryTypeFilter } from "@/observer/page/types/index.js";
import expandRow from "./expandRow/index.js";
import filterRows from "./filterRows/index.js";

/**
 * The history list as drawn: the rows the filters keep (oldest first in, reordered here), each
 * followed by its group of file writes, under a day header wherever the day changes. The first
 * header says `· newest first` while the list runs newest first, as the handoff draws it.
 */
export default function buildHistoryList({
	rows,
	type,
	session,
	newest,
}: {
	rows: HistoryRowModel[];
	type: HistoryTypeFilter;
	session: string;
	newest: boolean;
}): HistoryListItem[] {
	const kept = filterRows({ rows, type, session });
	const ordered = newest ? [...kept].reverse() : kept;

	const list: HistoryListItem[] = [];
	let previousDay: string | null = null;
	for (const row of ordered) {
		if (row.day !== previousDay) {
			const first = previousDay === null;
			list.push({ kind: "day", key: `day:${list.length}:${row.day}`, text: first && newest ? `${row.day} · newest first` : row.day });
			previousDay = row.day;
		}
		for (const line of expandRow({ row, filesOnly: type === "files" })) list.push({ kind: "row", row: line });
	}
	return list;
}
