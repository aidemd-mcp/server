import isClosedRecord from "@/service/observer/event/shared/isClosedRecord/index.js";
import isIsoDateTime from "@/service/observer/event/shared/isIsoDateTime/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";

const ENDED_BY = ["hook", "user", "transcript"] as const;
const KEYS = ["v", "sessionId", "claudeSessionId", "endedAt", "endedBy", "bySessionId"] as const;

/**
 * The shape of one ended mark, `<root>/<project-key>/ended/<id>.json`, written
 * once and never changed: `<id>` is the observer session id, or, for a Claude
 * session that never linked to an observer session, its Claude session id.
 * Exactly one of `sessionId` / `claudeSessionId` is present. `bySessionId` is
 * the session that wrote a `user` or `transcript` mark. `endedBy` is `hook`
 * (the session reported its end), `user` (ended by approval, never reopens),
 * or `transcript` (closed without reporting its end, written only by the
 * start check and end-session). Contract file: named exports, no default
 * export (brief commitments #72, #93, #95, #115, #118, #122).
 */
export type EndedMark = {
	v: 1;
	sessionId?: string;
	claudeSessionId?: string;
	endedAt: string;
	endedBy: (typeof ENDED_BY)[number];
	bySessionId?: string;
};

/**
 * Checks a parsed JSON value against the ended-mark shape. Returns a new object
 * with the keys in shape order (absent or `undefined` optional keys left out),
 * or null when the value does not fit: not an object, a key outside the shape,
 * `v` other than 1, an id that is not a safe session id, a time that is not an
 * ISO date-time, an unknown `endedBy`, or not exactly one of `sessionId` /
 * `claudeSessionId` (an `undefined` value counts as absent). It never throws.
 */
export function parse(value: unknown): EndedMark | null {
	if (!isClosedRecord(value, KEYS)) return null;
	const { v, sessionId, claudeSessionId, endedAt, endedBy, bySessionId } = value;

	if (v !== 1) return null;
	if (!isOptionalSessionId(sessionId)) return null;
	if (!isOptionalSessionId(claudeSessionId)) return null;
	if (typeof endedAt !== "string" || !isIsoDateTime(endedAt)) return null;
	if (!isEndedBy(endedBy)) return null;
	if (!isOptionalSessionId(bySessionId)) return null;
	if ((sessionId === undefined) === (claudeSessionId === undefined)) return null;

	return {
		v,
		...(sessionId !== undefined ? { sessionId } : {}),
		...(claudeSessionId !== undefined ? { claudeSessionId } : {}),
		endedAt,
		endedBy,
		...(bySessionId !== undefined ? { bySessionId } : {}),
	};
}

/** True when `value` is one of the `endedBy` values. */
function isEndedBy(value: unknown): value is (typeof ENDED_BY)[number] {
	return typeof value === "string" && (ENDED_BY as readonly string[]).includes(value);
}

/** True for `undefined` or a string that is a safe session id. */
function isOptionalSessionId(value: unknown): value is string | undefined {
	return value === undefined || (typeof value === "string" && isSessionId(value));
}
