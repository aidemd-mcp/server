import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import type { ReportedLocation } from "@/types/index.js";
import type { HeldSession } from "../../types/index.js";

/**
 * Picks where the newest session says its brain and kanban tag live, through event's
 * `findNewestStart` (the one rule for "what the newest session reported"). Callers pass one
 * project's sessions. Only the keys that event carries are returned, so an older session's value
 * never fills a gap. It never applies the `--brain` override (kanban does) and never reads
 * anything. No session_started at all gives null.
 */
export default function pickReportedLocation({ sessions }: { sessions: HeldSession[] }): ReportedLocation | null {
	const newest = findNewestStart({ sessions });
	if (newest === null) return null;

	const reported: ReportedLocation = {};
	if (newest.brainPath !== undefined) reported.brainPath = newest.brainPath;
	if (newest.kanbanTag !== undefined) reported.kanbanTag = newest.kanbanTag;
	return reported;
}
