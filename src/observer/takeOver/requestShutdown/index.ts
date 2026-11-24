import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { RunningObserver } from "../../types/index.js";

const REQUEST_TIMEOUT_MS = 1_000;

/**
 * Asks the running observer to stop: POST the shutdown route with its token and the caller's
 * version. 202 means it will stop, 409 means it refused (the caller is not strictly newer by its
 * own check), anything else, a timeout or a throw is a failure. Never throws.
 */
export default async function requestShutdown({
	observer,
	version,
}: {
	observer: RunningObserver;
	version: string;
}): Promise<"accepted" | "refused" | "failed"> {
	try {
		const response = await fetch(`${observer.address}${protocol.shutdownRoute}`, {
			method: "POST",
			headers: {
				[protocol.tokenHeader]: observer.token,
				"content-type": "application/json",
			},
			body: JSON.stringify({ version }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (response.status === 202) return "accepted";
		if (response.status === 409) return "refused";
		return "failed";
	} catch {
		return "failed";
	}
}
