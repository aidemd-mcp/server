import type { Dispatch } from "react";
import fetchProjects from "@/observer/page/api/fetchProjects/index.js";
import fetchStatus from "@/observer/page/api/fetchStatus/index.js";
import type { StreamAction } from "@/observer/page/types/index.js";

/**
 * Home's first load: the project list, then each listed project's view, each dispatched as the
 * same action the stream would send. A failed call is logged and skipped (the stream's own
 * connection state already says when the observer is unreachable); nothing is dispatched once
 * `isCancelled` says the page has moved on.
 */
export default async function loadProjects({
	token,
	dispatch,
	isCancelled,
}: {
	token: string;
	dispatch: Dispatch<StreamAction>;
	isCancelled: () => boolean;
}): Promise<void> {
	const listing = await fetchProjects({ token });
	if (isCancelled()) return;
	if (!listing.ok) {
		console.error(`The project list could not be loaded: ${listing.message}`);
		return;
	}
	dispatch({ name: "projects", data: { projects: listing.data.projects } });

	await Promise.all(
		listing.data.projects.map(async ({ projectKey }) => {
			const status = await fetchStatus({ token, projectKey });
			if (isCancelled()) return;
			if (!status.ok) {
				console.error(`The status of ${projectKey} could not be loaded: ${status.message}`);
				return;
			}
			dispatch({ name: "status", data: { projectKey, view: status.data } });
		}),
	);
}
