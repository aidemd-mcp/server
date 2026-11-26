import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import type { ReportedLocation } from "@/types/index.js";
import type { HeldSession } from "../../types/index.js";

/**
 * Picks the kanban tag the newest session reported, through event's `findNewestStart` (the one
 * rule for "what the newest session reported"). Callers pass one project's sessions. The board's
 * folder now comes from the project's brain config (brief #109), so the brain folder a session
 * reported is left in the event log and never returned here. Only the key that event carries is
 * returned, so an older session's value never fills a gap. It never applies the `--kanban`
 * override (kanban does) and never reads anything. No session_started at all gives null.
 */
export default function pickReportedLocation({ sessions }: { sessions: HeldSession[] }): ReportedLocation | null {
	const newest = findNewestStart({ sessions });
	if (newest === null) return null;

	const reported: ReportedLocation = {};
	if (newest.kanbanTag !== undefined) reported.kanbanTag = newest.kanbanTag;
	return reported;
}
