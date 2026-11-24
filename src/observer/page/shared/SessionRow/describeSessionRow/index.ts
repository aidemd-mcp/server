import type { SessionRowDescription, SessionRowModel } from "@/observer/page/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";

const BADGES: Record<SessionRowModel["liveness"], SessionRowDescription["badge"]> = {
	live: { className: "run", icon: "run", word: "Live" },
	idle: { className: "outline", icon: "idle", word: "Idle" },
	ended: { className: "neutral", icon: "power", word: "Ended" },
};

/**
 * What one sessions-list row prints: the start label (`Today 14:02`), the span from its start to
 * its last event (`0s` when it has none), the task line (null when no task was picked) and the
 * liveness badge. Reads only what the row reports; `now` only decides `Today` or `Yesterday`.
 */
export default function describeSessionRow({ row, now }: { row: SessionRowModel; now: Date }): SessionRowDescription {
	const seconds = row.lastEventAt === null ? 0 : (Date.parse(row.lastEventAt) - Date.parse(row.startedAt)) / 1000;
	return {
		startLabel: formatClock({ iso: row.startedAt, now }).start,
		duration: formatSpan(seconds),
		task: row.task,
		ended: row.liveness === "ended",
		live: row.liveness === "live",
		badge: BADGES[row.liveness],
	};
}
