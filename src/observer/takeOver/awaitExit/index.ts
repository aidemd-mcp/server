import isProcessRunning from "@/util/isProcessRunning/index.js";

/**
 * Polls whether `pid` is still a running process every `intervalMs` until it is gone (true) or
 * `timeoutMs` has passed (false). Checks once immediately, so a process that already exited
 * answers without waiting. Holds no timer once it settles.
 */
export default function awaitExit({
	pid,
	timeoutMs,
	intervalMs,
}: {
	pid: number;
	timeoutMs: number;
	intervalMs: number;
}): Promise<boolean> {
	return new Promise((resolve) => {
		if (!isProcessRunning(pid)) {
			resolve(true);
			return;
		}

		const deadline = Date.now() + timeoutMs;
		const timer = setInterval(() => {
			if (!isProcessRunning(pid)) {
				clearInterval(timer);
				resolve(true);
				return;
			}
			if (Date.now() >= deadline) {
				clearInterval(timer);
				resolve(false);
			}
		}, intervalMs);
	});
}
