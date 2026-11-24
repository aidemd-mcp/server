import isVersionBehind from "@/util/isVersionBehind/index.js";
import findRunningObserver from "../findRunningObserver/index.js";
import type { TakeOver } from "../types/index.js";
import awaitExit from "./awaitExit/index.js";
import requestShutdown from "./requestShutdown/index.js";

const EXIT_TIMEOUT_MS = 3_000;
const EXIT_INTERVAL_MS = 100;

/**
 * Decides what a start does about an observer that already runs (brief commitments #34, #37).
 * Nothing running: `none`. A running observer that is not strictly older than the caller (same,
 * newer, or either version unparseable) is `kept` without sending anything. An older one is asked
 * to shut down; if it refuses it is `kept`, otherwise its pid is polled for up to three seconds:
 * gone is `replaced`, still alive is `stuck`. It never kills a process.
 */
export default async function takeOver({ version }: { version: string }): Promise<TakeOver> {
	const running = await findRunningObserver();
	if (running === null) return { outcome: "none" };

	if (!isVersionBehind(running.version, version)) return { outcome: "kept", observer: running };

	const answer = await requestShutdown({ observer: running, version });
	if (answer === "refused") return { outcome: "kept", observer: running };

	const exited = await awaitExit({ pid: running.pid, timeoutMs: EXIT_TIMEOUT_MS, intervalMs: EXIT_INTERVAL_MS });
	if (!exited) return { outcome: "stuck", observer: running };

	return { outcome: "replaced", previous: running };
}
