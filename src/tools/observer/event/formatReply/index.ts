import type { RecordOutcome } from "@/types/index.js";

/** The substring the agent keys its one restart attempt on. */
const NOT_RUNNING_SUFFIX = "; observer not running";

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
 * observer did not reach it.
 */
export default function formatReply(outcome: RecordOutcome): string {
	const base = BASE_TEXT[outcome.logged](outcome.detail);
	if (REPORTS_DELIVERY.has(outcome.logged) && !outcome.delivered) return `${base}${NOT_RUNNING_SUFFIX}`;
	return base;
}
