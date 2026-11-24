import read from "@/service/observer/event/read/index.js";
import type { ProjectLog } from "@/types/index.js";
import describeError from "@/util/describeError/index.js";

/**
 * Replays every recorded session of every project from the event log so the observer starts with
 * history. Only history degrades on a failed read: the failure is written to stderr and the
 * observer starts with an empty replay, so live events still flow.
 */
export default async function replaySessions(): Promise<ProjectLog[]> {
	try {
		return await read();
	} catch (error) {
		const message = describeError({ error });
		process.stderr.write(`observer: replay failed: ${message}\n`);
		return [];
	}
}
