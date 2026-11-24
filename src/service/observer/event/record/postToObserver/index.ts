import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import readObserverRecord from "@/service/observer/event/shared/readObserverRecord/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

/** How long the post may take; the pipeline never waits longer for the live view. */
export const POST_TIMEOUT_MS = 250;

/**
 * Tell the machine's one running observer (the root `observer.json`) about an
 * event that is already on disk, tagged with the recording project's key in
 * the project header. True only
 * when the observer answers 2xx. It makes no request when no observer is
 * running, never retries, never starts anything, and never throws: the live
 * view is best effort and must not slow or fail the pipeline.
 */
export default async function postToObserver({
	projectRoot,
	event,
}: {
	projectRoot: string;
	event: ObserverEvent;
}): Promise<boolean> {
	try {
		const { observerFile } = resolveRoot();
		const { projectKey } = resolve({ projectRoot });

		const record = await readObserverRecord({ observerFile });
		if (record === null) return false;

		const response = await fetch(record.address + protocol.eventsRoute, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[protocol.tokenHeader]: record.token,
				[protocol.projectHeader]: projectKey,
			},
			body: JSON.stringify(event),
			signal: AbortSignal.timeout(POST_TIMEOUT_MS),
		});

		// Release the socket; the body is not needed.
		await response.body?.cancel();

		return response.ok;
	} catch {
		return false;
	}
}
