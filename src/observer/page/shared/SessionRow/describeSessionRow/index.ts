import type { SessionRowDescription, SessionRowModel } from "@/observer/page/types/index.js";
import describeLiveness from "@/observer/page/shared/describeLiveness/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";

/**
 * What one sessions-list row prints: the start label (`Today 14:02`), the span from its start to
 * its last event (`0s` when it has none), the task line (null when no task was picked) and the
 * liveness badge from `describeLiveness`. `ended` is the recorded state; `live` is a session that
 * is not ended and not quiet long enough to read as maybe stuck. `now` decides `Today` or
 * `Yesterday` and the quiet minutes.
 */
export default function describeSessionRow({ row, now }: { row: SessionRowModel; now: Date }): SessionRowDescription {
	const seconds = row.lastEventAt === null ? 0 : (Date.parse(row.lastEventAt) - Date.parse(row.startedAt)) / 1000;
	const { word, className, icon, stuck } = describeLiveness({ liveness: row.liveness, now });
	const ended = row.liveness.state === "ended";
	return {
		startLabel: formatClock({ iso: row.startedAt, now }).start,
		duration: formatSpan(seconds),
		task: row.task,
		ended,
		live: !ended && !stuck,
		badge: { word, className, icon },
	};
}
