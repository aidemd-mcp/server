import type { SessionLiveness } from "@/types/index.js";
import SESSION_QUIET_LIMIT_MS from "@/util/sessionQuietLimit/index.js";
import type { IconName } from "@/observer/page/types/index.js";

const MINUTE_MS = 60 * 1000;

/**
 * What a session's liveness reads as: its word, badge class, icon and whether it is quiet long
 * enough to read as maybe stuck. Only the quiet minutes are re-derived here, from the last
 * activity and `now`, so an open page keeps counting between frames; the state is never
 * re-derived, it is exactly what the recording side judged (brief #76, #101). A session that is
 * not ended and has been quiet longer than `SESSION_QUIET_LIMIT_MS` reads `Quiet <N> min · maybe
 * stuck`; an ended one never does.
 */
export default function describeLiveness({
	liveness,
	now,
}: {
	liveness: SessionLiveness;
	now: Date;
}): { word: string; className: "run" | "wait" | "neutral"; icon: IconName; stuck: boolean } {
	if (liveness.state === "ended") return { word: "Ended", className: "neutral", icon: "power", stuck: false };
	const quietMs = liveness.lastActivityAt === null ? 0 : Math.max(0, now.getTime() - new Date(liveness.lastActivityAt).getTime());
	if (quietMs > SESSION_QUIET_LIMIT_MS) {
		return { word: `Quiet ${Math.floor(quietMs / MINUTE_MS)} min · maybe stuck`, className: "neutral", icon: "idle", stuck: true };
	}
	if (liveness.state === "waiting") return { word: "Waiting on you", className: "wait", icon: "wait", stuck: false };
	return { word: "Working", className: "run", icon: "run", stuck: false };
}
