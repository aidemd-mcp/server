import type { ChildProcess } from "node:child_process";
import findRunningObserver from "@/observer/findRunningObserver/index.js";
import type { AwaitOutcome } from "../types/index.js";

const POLL_INTERVAL_MS = 100;
const ANSWER_TIMEOUT_MS = 10000;

/**
 * Waits for the freshly spawned observer to answer. Polls the no-input finder every interval and
 * settles on the first of: an observer answers (answered, with it), the child could not be
 * spawned (not started; the `"error"` event), the child exits (exit code 0 means the spawned view
 * found an observer already serving: one last finder call settles answered when it finds one;
 * any other code keeps polling, because a concurrent start's winner may still be publishing its
 * record, and the timeout then reports the busy port), or the timeout passes (the child is left
 * running, so a later start call reports it once it answers). Clears its timers and its own listeners either way; the
 * launcher's lasting `"error"` listener stays.
 */
export default function awaitObserver({
	port,
	child,
}: {
	port: number;
	child: ChildProcess;
}): Promise<AwaitOutcome> {
	return new Promise((resolve) => {
		let settled = false;
		let failedExitCode: number | null | undefined;
		let pollTimer: ReturnType<typeof setTimeout> | undefined;

		const settle = (result: AwaitOutcome) => {
			if (settled) return;
			settled = true;
			clearTimeout(pollTimer);
			clearTimeout(deadline);
			child.removeListener("exit", onExit);
			child.removeListener("error", onError);
			resolve(result);
		};

		const onError = (error: NodeJS.ErrnoException) => {
			settle({
				outcome: "not-started",
				reason: `the observer process could not be started (${error.code ?? error.message})`,
			});
		};

		const onExit = async (code: number | null) => {
			if (code !== 0) {
				// A losing concurrent start also exits here while the winner is still publishing its
				// record; keep polling until it answers or the deadline names the busy port.
				failedExitCode = code;
				return;
			}
			// Exit 0: the spawned view found an observer already serving; look once more for it.
			const found = await findRunningObserver();
			if (found) return settle({ outcome: "answered", observer: found });
			settle({
				outcome: "not-started",
				reason: "the observer process exited (exit code 0) but no observer answers; call aide_observer_start again",
			});
		};

		const deadline = setTimeout(() => {
			if (failedExitCode !== undefined) {
				return settle({
					outcome: "not-started",
					reason: `port ${port} is busy or the observer could not start (exit code ${failedExitCode})`,
				});
			}
			settle({
				outcome: "not-started",
				reason: `the observer did not answer on port ${port} within ${ANSWER_TIMEOUT_MS / 1000} s`,
			});
		}, ANSWER_TIMEOUT_MS);

		const poll = async () => {
			const found = await findRunningObserver();
			if (settled) return;
			if (found) return settle({ outcome: "answered", observer: found });
			pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
		};

		child.on("exit", onExit);
		child.on("error", onError);
		void poll();
	});
}
