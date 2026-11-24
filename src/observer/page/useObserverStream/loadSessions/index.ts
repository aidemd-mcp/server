import type { Dispatch } from "react";
import fetchSessions from "@/observer/page/api/fetchSessions/index.js";
import type { StreamAction } from "@/observer/page/types/index.js";

/**
 * Loads one project's session list and dispatches it as the `sessions` action the stream would
 * send. Used for a project with no reported root, whose view carries no sessions. A failed call is
 * logged and skipped; nothing is dispatched once `isCancelled` says the page has moved on.
 */
export default async function loadSessions({
	token,
	projectKey,
	dispatch,
	isCancelled,
}: {
	token: string;
	projectKey: string;
	dispatch: Dispatch<StreamAction>;
	isCancelled: () => boolean;
}): Promise<void> {
	const listing = await fetchSessions({ token, projectKey });
	if (isCancelled()) return;
	if (!listing.ok) {
		console.error(`The sessions of ${projectKey} could not be loaded: ${listing.message}`);
		return;
	}
	dispatch({ name: "sessions", data: { projectKey, sessions: listing.data.sessions } });
}
