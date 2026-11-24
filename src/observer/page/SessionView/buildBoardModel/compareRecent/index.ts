import type { BoardTask } from "@/types/index.js";

/** The task's `updated` as a time, or null when it has none or it does not parse. */
function readUpdated({ task }: { task: BoardTask }): number | null {
	if (task.state !== "readable" || task.updated === undefined) return null;
	const time = Date.parse(task.updated);
	return Number.isNaN(time) ? null : time;
}

/**
 * Orders tasks newest `updated` first for the Done column: a task with no usable `updated` comes
 * after every dated one, and equal times (or two undated tasks) fall back to the slug.
 */
export default function compareRecent(a: BoardTask, b: BoardTask): number {
	const timeA = readUpdated({ task: a });
	const timeB = readUpdated({ task: b });
	if (timeA !== null && timeB !== null && timeA !== timeB) return timeB - timeA;
	if (timeA !== null && timeB === null) return -1;
	if (timeA === null && timeB !== null) return 1;
	return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
