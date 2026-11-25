import readEndedMark from "@/service/observer/event/shared/readEndedMark/index.js";
import readTranscriptActivity from "@/service/observer/event/shared/readTranscriptActivity/index.js";
import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { SessionLiveness } from "@/service/observer/event/types/index.js";

/**
 * Judges one entry: reads its ended mark (under `markId`) and its presence's
 * transcript activity in parallel, then hands everything to the pure rule. A
 * mark or transcript that cannot be read counts as absent, so one bad file
 * never fails the entry (both readers answer null instead of throwing).
 */
export default async function judgeEntry({
	projectKey,
	markId,
	events,
	presence,
	now,
}: {
	projectKey: string;
	markId: string;
	events: ObserverEvent[];
	presence: Presence | null;
	now: number;
}): Promise<SessionLiveness> {
	const [endedMark, transcriptActivityAt] = await Promise.all([
		readEndedMark({ projectKey, id: markId }),
		readTranscriptActivity({ transcriptPath: presence?.transcriptPath }),
	]);

	return judgeLiveness({ events, presence, endedMark, transcriptActivityAt, now });
}
