import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { TouchPresenceInput } from "@/service/observer/event/types/index.js";

/**
 * Merge one hook call into a Claude session's presence record (brief
 * commitment #72). Pure. The newest `at` wins: when the existing record is
 * newer, its `state`, `at` and `hookEvent` stay, and only a missing link or a
 * missing transcript path is filled from the call. Otherwise the call's state
 * and time win, the link and the transcript path of the call replace the old
 * ones when it carries them, and the old ones are kept when it does not.
 * Absent fields are omitted, never `undefined`.
 */
export default function mergePresence({
	existing,
	next,
}: {
	existing: Presence | null;
	next: TouchPresenceInput;
}): Presence {
	const existingIsNewer = existing !== null && Date.parse(existing.at) > Date.parse(next.at);

	if (existingIsNewer) {
		const sessionId = existing.sessionId ?? next.linkSessionId;
		const transcriptPath = existing.transcriptPath ?? next.transcriptPath;
		return {
			...existing,
			...(sessionId !== undefined ? { sessionId } : {}),
			...(transcriptPath !== undefined ? { transcriptPath } : {}),
		};
	}

	const sessionId = next.linkSessionId ?? existing?.sessionId;
	const transcriptPath = next.transcriptPath ?? existing?.transcriptPath;
	return {
		v: 1,
		claudeSessionId: next.claudeSessionId,
		...(sessionId !== undefined ? { sessionId } : {}),
		state: next.state,
		at: next.at,
		hookEvent: next.hookEvent,
		...(transcriptPath !== undefined ? { transcriptPath } : {}),
	};
}
