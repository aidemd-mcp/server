import type { HistoryCategory, HistoryRowModel } from "@/observer/page/types/index.js";

/**
 * How many rows each type filter would list. A row counts under its own category; a row that has a
 * group of file writes folded under it also counts once under `files`, as the Files filter lists
 * the groups. A standalone `files` row already counts as files.
 */
export default function countCategories({ rows }: { rows: HistoryRowModel[] }): Partial<Record<HistoryCategory, number>> {
	const counts: Partial<Record<HistoryCategory, number>> = {};
	for (const row of rows) {
		counts[row.category] = (counts[row.category] ?? 0) + 1;
		if (row.kind !== "files" && row.files.length > 0) counts.files = (counts.files ?? 0) + 1;
	}
	return counts;
}
