import type { ProjectView, SessionListing } from "@/observer/types/index.js";

/** The kanban tag of a project: its board's when the board is readable, else the newest listed session's reported one. */
export default function findKanbanTag({
	view,
	sessions,
}: {
	view: ProjectView | undefined;
	sessions: SessionListing[];
}): string | null {
	if (view?.state === "ready" && view.status.board.state === "available") return view.status.board.kanbanTag;
	let newest: SessionListing | null = null;
	for (const session of sessions) {
		if (!session.metadata?.kanbanTag) continue;
		if (newest === null || (session.startedAt ?? "") > (newest.startedAt ?? "")) newest = session;
	}
	return newest?.metadata?.kanbanTag ?? null;
}
