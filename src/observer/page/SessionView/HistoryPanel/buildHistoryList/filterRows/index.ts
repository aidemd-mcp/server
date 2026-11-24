import type { HistoryRowModel, HistoryTypeFilter } from "@/observer/page/types/index.js";

/**
 * The rows one filter pair keeps: `session` is a session id or `all`; `type` is `all`, or a
 * category. The Files filter keeps the rows that hold file writes (a group, or a row with a group
 * under it); every other category keeps the rows of that category.
 */
export default function filterRows({
	rows,
	type,
	session,
}: {
	rows: HistoryRowModel[];
	type: HistoryTypeFilter;
	session: string;
}): HistoryRowModel[] {
	return rows.filter((row) => {
		if (session !== "all" && row.sessionId !== session) return false;
		if (type === "all") return true;
		if (type === "files") return row.kind === "files" || row.files.length > 0;
		return row.category === type;
	});
}
