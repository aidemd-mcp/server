import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import summarizeSessions from "../summarizeSessions/index.js";
import type { HeldSession, ProjectListing } from "../../types/index.js";

/**
 * Turns the held sessions into the home list: one row per project key, each with the root its
 * newest session reported (event's `findNewestStart`, null when none did), its session rows
 * (liveness by `judgeLiveness` through `summarizeSessions`) and the time of its latest event.
 * Projects are ordered by `lastEventAt` descending, ties by key, so the home list applies the same
 * rules `event/read` applies to the same logs. Pure.
 */
export default function summarizeProjects({
	sessions,
	now,
}: {
	sessions: HeldSession[];
	now: number;
}): ProjectListing[] {
	const byProject = new Map<string, HeldSession[]>();
	for (const session of sessions) {
		const held = byProject.get(session.projectKey);
		if (held === undefined) byProject.set(session.projectKey, [session]);
		else held.push(session);
	}

	const listings = [...byProject].map(([projectKey, held]): ProjectListing => {
		const rows = summarizeSessions({ sessions: held, now });
		const lastEventAt = rows.reduce<string | null>(
			(latest, row) => (row.lastEventAt !== null && (latest === null || row.lastEventAt > latest) ? row.lastEventAt : latest),
			null,
		);
		return { projectKey, projectRoot: findNewestStart({ sessions: held })?.projectRoot ?? null, sessions: rows, lastEventAt };
	});

	return listings.sort((a, b) => {
		if (a.lastEventAt !== b.lastEventAt) {
			if (a.lastEventAt === null) return 1;
			if (b.lastEventAt === null) return -1;
			return a.lastEventAt < b.lastEventAt ? 1 : -1;
		}
		return a.projectKey < b.projectKey ? -1 : a.projectKey > b.projectKey ? 1 : 0;
	});
}
