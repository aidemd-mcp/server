import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { Conversation } from "@/service/observer/event/types/index.js";

/** The observer session ids a presence is linked to: the current one and every earlier one. */
function linksOf(presence: Presence): string[] {
	return [...(presence.sessionId === undefined ? [] : [presence.sessionId]), ...(presence.earlierSessionIds ?? [])];
}

/**
 * Groups a project's presence records into conversations (brief commitments
 * #132, #133), pure. Presences that share any observer session id are one
 * conversation, transitively: a `/clear` gives one observer session several
 * Claude ids (#92) and a resume gives one Claude id several observer sessions.
 * A presence with no link at all is a conversation of its own with no observer
 * ids. Output is ordered by the first observer id (unlinked ones last, by
 * Claude id); ids inside a conversation ascend and appear once.
 */
export default function groupConversations({ presences }: { presences: Presence[] }): Conversation[] {
	// 1. Fold each linked presence into the groups it shares an id with.
	let groups: { sessionIds: Set<string>; presences: Presence[] }[] = [];
	for (const presence of presences.filter((candidate) => linksOf(candidate).length > 0)) {
		const links = linksOf(presence);
		const touched = groups.filter((group) => links.some((id) => group.sessionIds.has(id)));
		groups = groups.filter((group) => !touched.includes(group));
		groups.push({
			sessionIds: new Set([...touched.flatMap((group) => [...group.sessionIds]), ...links]),
			presences: [...touched.flatMap((group) => group.presences), presence],
		});
	}

	// 2. Normalise to ascending ids and order the groups by their first observer id.
	const linked = groups
		.map(
			({ sessionIds, presences: members }): Conversation => ({
				sessionIds: [...sessionIds].sort(),
				claudeSessionIds: [...new Set(members.map((member) => member.claudeSessionId))].sort(),
				presences: [...members].sort((a, b) => a.claudeSessionId.localeCompare(b.claudeSessionId)),
			}),
		)
		.sort((a, b) => a.sessionIds[0].localeCompare(b.sessionIds[0]));

	// 3. Presences with no link are conversations of one, after the linked ones.
	const unlinked = presences
		.filter((presence) => linksOf(presence).length === 0)
		.sort((a, b) => a.claudeSessionId.localeCompare(b.claudeSessionId))
		.map(
			(presence): Conversation => ({
				sessionIds: [],
				claudeSessionIds: [presence.claudeSessionId],
				presences: [presence],
			}),
		);

	return [...linked, ...unlinked];
}
