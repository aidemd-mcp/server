import type { SessionRowModel } from "@/observer/page/types/index.js";

/** The time of a project's latest event: the newest of its rows, else what the project listing reported. */
export default function findLastEventAt({
	rows,
	listed,
}: {
	rows: SessionRowModel[];
	listed: string | null;
}): string | null {
	let newest = listed;
	for (const row of rows) {
		const at = row.lastEventAt ?? row.startedAt;
		if (newest === null || at > newest) newest = at;
	}
	return newest;
}
