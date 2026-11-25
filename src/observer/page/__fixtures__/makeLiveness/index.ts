import type { SessionLiveness } from "@/types/index.js";
import SESSION_QUIET_LIMIT_MS from "@/util/sessionQuietLimit/index.js";

const MINUTE_MS = 60 * 1000;

/**
 * A session's liveness in `state` (default `working`) whose last activity was `minutesQuiet`
 * minutes (default 0) before `now` (default the real clock; tests pass theirs).
 */
export default function makeLiveness({
	state = "working",
	minutesQuiet = 0,
	now = new Date(),
}: { state?: SessionLiveness["state"]; minutesQuiet?: number; now?: Date } = {}): SessionLiveness {
	return {
		state,
		lastActivityAt: new Date(now.getTime() - minutesQuiet * MINUTE_MS).toISOString(),
		quietMinutes: minutesQuiet,
		maybeStuck: state !== "ended" && minutesQuiet * MINUTE_MS > SESSION_QUIET_LIMIT_MS,
	};
}
