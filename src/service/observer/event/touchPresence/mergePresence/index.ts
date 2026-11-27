import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { TouchPresenceInput } from "@/service/observer/event/types/index.js";

/** The most earlier links a presence keeps; the schema caps `earlierSessionIds` at the same number. */
const EARLIER_SESSION_IDS_MAX = 100;

/**
 * Merge one hook call into a Claude session's presence record (brief
 * commitments #72, #126, #132). Pure. The newest `at` wins for `state`, `at`
 * and `hookEvent`: when the existing record is newer they stay, and only a
 * missing transcript path is filled from the call; otherwise the call's state
 * and time win and its transcript path replaces the old one when it carries
 * one. Links are added, never replaced: the link set is the union of the
 * existing `sessionId`, its `earlierSessionIds` and the call's link, whichever
 * record is newer. `sessionId` is the greatest id of the set (session ids sort
 * chronologically, brief #20) and the rest go to `earlierSessionIds` ascending,
 * capped at the newest 100, so two hooks racing never lose a link. Absent
 * fields are omitted, never `undefined`.
 */
export default function mergePresence({
	existing,
	next,
}: {
	existing: Presence | null;
	next: TouchPresenceInput;
}): Presence {
	const links = [
		...new Set([
			...(existing?.sessionId !== undefined ? [existing.sessionId] : []),
			...(existing?.earlierSessionIds ?? []),
			...(next.linkSessionId !== undefined ? [next.linkSessionId] : []),
		]),
	].sort();
	const sessionId = links.pop();
	const earlierSessionIds = links.slice(-EARLIER_SESSION_IDS_MAX);
	const linkFields = {
		...(sessionId !== undefined ? { sessionId } : {}),
		...(earlierSessionIds.length > 0 ? { earlierSessionIds } : {}),
	};

	const existingIsNewer = existing !== null && Date.parse(existing.at) > Date.parse(next.at);

	if (existingIsNewer) {
		const { sessionId: _sessionId, earlierSessionIds: _earlier, ...rest } = existing;
		const transcriptPath = existing.transcriptPath ?? next.transcriptPath;
		return {
			...rest,
			...linkFields,
			...(transcriptPath !== undefined ? { transcriptPath } : {}),
		};
	}

	const transcriptPath = next.transcriptPath ?? existing?.transcriptPath;
	return {
		v: 1,
		claudeSessionId: next.claudeSessionId,
		...linkFields,
		state: next.state,
		at: next.at,
		hookEvent: next.hookEvent,
		...(transcriptPath !== undefined ? { transcriptPath } : {}),
	};
}
