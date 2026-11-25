import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import type { LivenessReport } from "@/types/index.js";
import summarizeSessions from "../summarizeSessions/index.js";
import type { HeldSession, ProjectListing } from "../../types/index.js";

/**
 * Turns the held sessions into the home list: one row per project key, each with the root its
 * newest session reported (event's `findNewestStart`, null when none did), its session rows
 * (liveness copied from that project's report in `liveness` through `summarizeSessions`) and the
 * time of its latest event. Projects are ordered by `lastEventAt` descending, ties by key, so the
 * home list applies the same rules `event/read` applies to the same logs. Pure; a project with no
 * report throws.
 */
export default function summarizeProjects({
	sessions,
	liveness,
}: {
	sessions: HeldSession[];
	liveness: Map<string, LivenessReport>;
}): ProjectListing[] {
	const byProject = new Map<string, HeldSession[]>();
	for (const session of sessions) {
		const held = byProject.get(session.projectKey);
		if (held === undefined) byProject.set(session.projectKey, [session]);
		else held.push(session);
	}

	const listings = [...byProject].map(([projectKey, held]): ProjectListing => {
		const report = liveness.get(projectKey);
		if (report === undefined) throw new Error(`No liveness was read for project ${projectKey}.`);
		const rows = summarizeSessions({ sessions: held, liveness: report.sessions });
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
