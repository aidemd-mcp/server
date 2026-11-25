import { createRequire } from "node:module";
import type * as Http from "node:http";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import readObserverRecord from "@/service/observer/event/shared/readObserverRecord/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";

// A static ESM import of node:http evaluates its web getters and loads undici on every hook run.
const { request } = createRequire(import.meta.url)("node:http") as typeof Http;

/** How long the ping may take; the hook never waits longer for the live view. */
export const PING_TIMEOUT_MS = 250;

/**
 * Tell the machine's one running observer that a Claude session's presence
 * changed on disk (brief commitments #75, #99). The ping carries no state: the
 * observer re-reads the file. True only when the observer answers 2xx. It
 * makes no request when no observer is running, never retries, never starts
 * anything, and never throws. It uses `node:http` with no keep-alive agent
 * (brief commitment #103 as amended): the target is the loopback address of
 * `observer.json`, and no socket outlives the call.
 */
export default async function pingObserver({
	projectKey,
	claudeSessionId,
}: {
	projectKey: string;
	claudeSessionId: string;
}): Promise<boolean> {
	try {
		const { observerFile } = resolveRoot();

		const record = await readObserverRecord({ observerFile });
		if (record === null) return false;

		const body = JSON.stringify({ claudeSessionId });
		return await new Promise<boolean>((resolve) => {
			const req = request(
				record.address + protocol.presenceRoute,
				{
					method: "POST",
					agent: false,
					headers: {
						"content-type": "application/json",
						"content-length": Buffer.byteLength(body),
						[protocol.tokenHeader]: record.token,
						[protocol.projectHeader]: projectKey,
					},
				},
				(response) => {
					const status = response.statusCode ?? 0;
					// Drain the body so the socket closes; it is not needed.
					response.resume();
					response.on("end", () => {
						clearTimeout(cap);
						resolve(status >= 200 && status < 300);
					});
					response.on("error", () => {
						clearTimeout(cap);
						resolve(false);
					});
				},
			);
			// A hard cap on the whole call, not an idle timeout: a slow server cannot stretch the hook.
			const cap = setTimeout(() => {
				req.destroy();
				resolve(false);
			}, PING_TIMEOUT_MS);
			req.on("error", () => {
				clearTimeout(cap);
				resolve(false);
			});
			req.end(body);
		});
	} catch {
		return false;
	}
}
