import type { RecordOutcome } from "@/types/index.js";
import formatSessionTag from "@/service/observer/event/shared/formatSessionTag/index.js";

/** The substring the agent keys its one restart attempt on. */
const NOT_RUNNING_SUFFIX = "; observer not running";

/** Tells the agent a report came from an ended session, so the start check must run before anything else. */
const PREVIOUSLY_ENDED_SUFFIX = "; previously ended: run aide_observer_start before anything else";

/** Base reply text per `logged` value; `detail` is empty when absent. */
const BASE_TEXT: Record<RecordOutcome["logged"], (detail: string | undefined) => string> = {
	written: () => "recorded",
	"write-failed": (detail) => (detail ? `not recorded (${detail})` : "not recorded"),
	invalid: (detail) => (detail ? `not recorded: invalid event (${detail})` : "not recorded: invalid event"),
	"repeat-session-start": () => "session already started; nothing recorded",
};

/** Outcomes whose event was meant for the observer, so a missed delivery is worth reporting. */
const REPORTS_DELIVERY: ReadonlySet<RecordOutcome["logged"]> = new Set(["written", "write-failed"]);

/**
 * Turns a record outcome into the one reply line of `aide_observer_event`.
 * `; observer not running` is appended only when an event meant for the
 * observer did not reach it; `; previously ended: ...` follows it when the
 * outcome says the session was ended earlier (a report is never refused, only
 * flagged); every reply ends with the session tag the hook links the Claude
 * session by (brief commitments #90, #97, #121, #131).
 */
export default function formatReply(outcome: RecordOutcome): string {
	const base = BASE_TEXT[outcome.logged](outcome.detail);
	const delivery = REPORTS_DELIVERY.has(outcome.logged) && !outcome.delivered ? NOT_RUNNING_SUFFIX : "";
	const ended = outcome.previouslyEnded ? PREVIOUSLY_ENDED_SUFFIX : "";
	return `${base}${delivery}${ended} ${formatSessionTag(outcome.sessionId)}`;
}
