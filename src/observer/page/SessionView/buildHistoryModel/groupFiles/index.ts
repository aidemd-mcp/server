import type { HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";

type Entry = { row: HistoryRowModel; standalone: boolean; subs: HistoryRowModel[] };

/** The `Wrote <n> file(s)` row for a group of `sub` rows; `row` is the row it hangs under, or (standalone) the first write, which supplies its time. */
function buildGroup({ entry }: { entry: Entry }): HistoryRowModel {
	const { row, standalone, subs } = entry;
	return {
		id: `files:${subs[0]!.id}`,
		sessionId: row.sessionId,
		time: standalone ? row.time : "",
		day: row.day,
		kind: "files",
		category: KIND_FACTS.files.category,
		icon: KIND_FACTS.files.icon,
		kindWord: KIND_FACTS.files.kindWord,
		label: `Wrote ${subs.length} ${subs.length === 1 ? "file" : "files"}`,
		mono: null,
		meta: null,
		sessionTag: standalone ? row.sessionTag : null,
		item: standalone ? null : row.item,
		files: subs,
	};
}

/**
 * Folds each session's run of file writes (consecutive `sub` rows of that session) under the row
 * before it in that session, as one `files` row `Wrote <n> file(s)` that holds a `sub` row per
 * path. A run with no row before it in its session stands as its own `files` row. Rows come and go
 * in the order they were given (oldest first); the input rows are not changed.
 */
export default function groupFiles({ rows }: { rows: HistoryRowModel[] }): HistoryRowModel[] {
	const entries: Entry[] = [];
	const latest = new Map<string, Entry>();

	for (const row of rows) {
		if (row.kind !== "sub") {
			const entry = { row: { ...row, files: [] }, standalone: false, subs: [] };
			entries.push(entry);
			latest.set(row.sessionId, entry);
			continue;
		}

		const sub = { ...row, time: "" };
		const before = latest.get(row.sessionId);
		if (before !== undefined) {
			before.subs.push(sub);
			continue;
		}
		const entry = { row, standalone: true, subs: [sub] };
		entries.push(entry);
		latest.set(row.sessionId, entry);
	}

	return entries.map((entry) => {
		if (entry.standalone) return buildGroup({ entry });
		return entry.subs.length === 0 ? entry.row : { ...entry.row, files: [buildGroup({ entry })] };
	});
}
