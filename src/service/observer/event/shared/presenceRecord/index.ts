import isClosedRecord from "@/service/observer/event/shared/isClosedRecord/index.js";
import isIsoDateTime from "@/service/observer/event/shared/isIsoDateTime/index.js";
import { PATH_MAX } from "@/service/observer/event/shared/limits/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";

const STATES = ["working", "waiting", "ended"] as const;
const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"] as const;
const KEYS = [
	"v",
	"claudeSessionId",
	"sessionId",
	"earlierSessionIds",
	"state",
	"at",
	"hookEvent",
	"transcriptPath",
] as const;
const EARLIER_SESSION_IDS_MAX = 100;

/**
 * The shape of one Claude session's hook presence file,
 * `<root>/<project-key>/presence/<claudeSessionId>.json`: the hook writes it
 * (replaced whole on every call, newest `at` wins), and `readPresence` and the
 * liveness reader read it with `parse`. `sessionId` is the newest
 * observer session the Claude session is linked to; it is absent until the
 * link lands. `earlierSessionIds` holds every earlier observer session of
 * this Claude session (a resumed conversation arrives under a new observer
 * session, brief commitments #126, #132): ascending, unique, never containing
 * `sessionId`, at most 100, and absent when there are none.
 * Contract file: named exports, no default export (brief commitment #95).
 */
export type Presence = {
	v: 1;
	claudeSessionId: string;
	sessionId?: string;
	earlierSessionIds?: string[];
	state: (typeof STATES)[number];
	at: string;
	hookEvent: (typeof HOOK_EVENTS)[number];
	transcriptPath?: string;
};

/**
 * Checks a parsed JSON value against the presence shape. Returns a new object
 * with the keys in shape order (absent or `undefined` optional keys left out,
 * `earlierSessionIds` copied), or null when the value does not fit: not an
 * object, a key outside the shape, `v` other than 1, an id that is not a safe
 * session id, an unknown state or hook event, a time that is not an ISO
 * date-time, more than 100 earlier ids, or a transcript path that is empty or
 * longer than the path limit. It never throws. The key order matters:
 * `touchPresence` decides whether to write by comparing JSON text.
 */
export function parse(value: unknown): Presence | null {
	if (!isClosedRecord(value, KEYS)) return null;
	const { v, claudeSessionId, sessionId, earlierSessionIds, state, at, hookEvent, transcriptPath } = value;

	if (v !== 1) return null;
	if (typeof claudeSessionId !== "string" || !isSessionId(claudeSessionId)) return null;
	if (sessionId !== undefined && (typeof sessionId !== "string" || !isSessionId(sessionId))) return null;
	if (earlierSessionIds !== undefined && !isEarlierSessionIds(earlierSessionIds)) return null;
	if (!isMember(STATES, state)) return null;
	if (typeof at !== "string" || !isIsoDateTime(at)) return null;
	if (!isMember(HOOK_EVENTS, hookEvent)) return null;
	if (
		transcriptPath !== undefined &&
		(typeof transcriptPath !== "string" || transcriptPath.length < 1 || transcriptPath.length > PATH_MAX)
	) {
		return null;
	}

	return {
		v,
		claudeSessionId,
		...(sessionId !== undefined ? { sessionId } : {}),
		...(earlierSessionIds !== undefined ? { earlierSessionIds: [...earlierSessionIds] } : {}),
		state,
		at,
		hookEvent,
		...(transcriptPath !== undefined ? { transcriptPath } : {}),
	};
}

/** True when `value` is one of `list`, narrowing it to the list's element type. */
function isMember<T extends string>(list: readonly T[], value: unknown): value is T {
	return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** True for an array of at most 100 safe session ids; order and repeats are not checked. */
function isEarlierSessionIds(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length <= EARLIER_SESSION_IDS_MAX &&
		value.every((id) => typeof id === "string" && isSessionId(id))
	);
}
