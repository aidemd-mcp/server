import { schema } from "@/service/observer/event/shared/schema/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

/**
 * Turns the text of one session file into its valid events, in `seq` order.
 * A line that is not JSON, is off-schema, or belongs to another session is
 * skipped and counted; blank lines are ignored and not counted. Never throws:
 * a half-written or hand-edited file must still yield every good event.
 */
export default function parseLines({
	content,
	sessionId,
}: {
	content: string;
	sessionId: string;
}): { events: ObserverEvent[]; skippedLines: number } {
	const events: ObserverEvent[] = [];
	let skippedLines = 0;

	for (const line of content.split(/\r?\n/)) {
		if (line.trim() === "") continue;

		let json: unknown;
		try {
			json = JSON.parse(line);
		} catch {
			skippedLines += 1;
			continue;
		}

		const parsed = schema.safeParse(json);
		if (!parsed.success || parsed.data.sessionId !== sessionId) {
			skippedLines += 1;
			continue;
		}

		events.push(parsed.data);
	}

	// Array.prototype.sort is stable, so equal seq values keep file order.
	events.sort((a, b) => a.seq - b.seq);

	return { events, skippedLines };
}
