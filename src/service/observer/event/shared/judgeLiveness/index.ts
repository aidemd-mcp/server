import SESSION_QUIET_LIMIT_MS from "@/util/sessionQuietLimit/index.js";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { SessionLiveness } from "@/service/observer/event/types/index.js";

const MINUTE_MS = 60 * 1000;

/**
 * The one liveness rule (brief commitments #76, #94, #96, #115), pure. In
 * order: an ended mark ends the session (with its `endedBy`); else a presence
 * in state `ended` ends it (`endedBy: "hook"`); else a presence whose
 * transcript ends in the session's own closing record (`transcriptClosed`)
 * ends it (`endedBy: "transcript"`); else the presence's last state stands;
 * else, with no presence at all, the session is `working` whatever its schema
 * version (`transcriptClosed` is only consulted when a presence exists). Nothing ends a session by itself: quiet time only sets
 * `maybeStuck`, once `now` is more than `SESSION_QUIET_LIMIT_MS` past the
 * newest of the presence time, the transcript's last write and the newest
 * event time. No pid, no heartbeat.
 */
export default function judgeLiveness({
	events,
	presence,
	endedMark,
	transcriptActivityAt,
	transcriptClosed,
	now,
}: {
	events: ObserverEvent[];
	presence: Presence | null;
	endedMark: EndedMark | null;
	transcriptActivityAt: string | null;
	transcriptClosed: boolean;
	now: number;
}): SessionLiveness {
	// 1. The newest of the three activity sources, kept as the ISO string it came as.
	const stamps = [presence?.at, transcriptActivityAt, ...events.map((event) => event.ts)]
		.filter((stamp): stamp is string => typeof stamp === "string")
		.map((stamp) => ({ stamp, time: Date.parse(stamp) }))
		.filter(({ time }) => Number.isFinite(time));
	const newest = stamps.reduce<{ stamp: string; time: number } | null>(
		(latest, candidate) => (latest === null || candidate.time > latest.time ? candidate : latest),
		null,
	);
	const lastActivityAt = newest?.stamp ?? null;
	const quietMs = newest === null ? 0 : Math.max(0, now - newest.time);
	const quietMinutes = Math.floor(quietMs / MINUTE_MS);

	// 2. The state, in the brief's order: mark, presence ended, transcript, presence state, working.
	if (endedMark !== null) {
		return { state: "ended", lastActivityAt, quietMinutes, maybeStuck: false, endedBy: endedMark.endedBy };
	}
	if (presence?.state === "ended") {
		return { state: "ended", lastActivityAt, quietMinutes, maybeStuck: false, endedBy: "hook" };
	}
	if (presence !== null && transcriptClosed) {
		return { state: "ended", lastActivityAt, quietMinutes, maybeStuck: false, endedBy: "transcript" };
	}

	return {
		state: presence?.state ?? "working",
		lastActivityAt,
		quietMinutes,
		maybeStuck: newest !== null && quietMs > SESSION_QUIET_LIMIT_MS,
	};
}
