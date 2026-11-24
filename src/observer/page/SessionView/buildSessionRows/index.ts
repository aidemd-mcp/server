import type { SessionListing } from "@/observer/types/index.js";
import type { ObserverEvent, SessionSummary } from "@/types/index.js";
import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";

type HeldEvents = { sessionId: string; events: ObserverEvent[] }[];

/** The title (else the slug) of the newest `task` event the session holds, or null. */
function findTask({ held, sessionId }: { held: HeldEvents; sessionId: string }): string | null {
	let newest: Extract<ObserverEvent, { kind: "task" }> | null = null;
	for (const session of held) {
		if (session.sessionId !== sessionId) continue;
		for (const event of session.events) {
			if (event.kind === "task" && (newest === null || event.seq > newest.seq)) newest = event;
		}
	}
	return newest === null ? null : (newest.title ?? newest.slug);
}

/** One model per session from the status's summaries, which carry the observer's three-state liveness. */
function fromSummaries({ summaries }: { summaries: SessionSummary[] }): Omit<SessionRowModel, "task" | "label">[] {
	return summaries.map((summary) => ({
		sessionId: summary.sessionId,
		startedAt: summary.startedAt,
		lastEventAt: summary.lastEventAt,
		eventCount: summary.eventCount,
		liveness: summary.liveness,
	}));
}

/** One model per listing that has a start time (a session with no readable event has nothing to show). */
function fromListings({ listings }: { listings: SessionListing[] }): Omit<SessionRowModel, "task" | "label">[] {
	const rows: Omit<SessionRowModel, "task" | "label">[] = [];
	for (const listing of listings) {
		if (listing.startedAt === null) continue;
		rows.push({
			sessionId: listing.sessionId,
			startedAt: listing.startedAt,
			lastEventAt: listing.lastEventAt,
			eventCount: listing.eventCount,
			liveness: listing.live ? "live" : "ended",
		});
	}
	return rows;
}

/**
 * The sessions list rows, newest first. Rows come from the status's `summaries` when the view is
 * ready, else from the `listings` the sessions route reports. Each row's task is the newest `task`
 * event the stream holds for it. With two or more live or idle sessions they are labelled `S1`,
 * `S2`, ... in start order.
 */
export default function buildSessionRows({
	summaries,
	listings,
	held,
}: {
	summaries?: SessionSummary[];
	listings?: SessionListing[];
	held: HeldEvents;
}): SessionRowModel[] {
	const base = summaries ? fromSummaries({ summaries }) : listings ? fromListings({ listings }) : [];

	const active = base
		.filter(isActiveSession)
		.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : a.sessionId < b.sessionId ? -1 : 1));
	const labels = new Map<string, string>();
	if (active.length >= 2) active.forEach((row, index) => labels.set(row.sessionId, `S${index + 1}`));

	return base
		.map((row) => ({ ...row, task: findTask({ held, sessionId: row.sessionId }), label: labels.get(row.sessionId) ?? null }))
		.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : a.sessionId < b.sessionId ? 1 : -1));
}
