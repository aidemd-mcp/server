import createSessionId from "@/service/observer/event/record/session/createSessionId/index.js";
import type { ProcessSession } from "@/service/observer/event/types/index.js";

/** Builds the process's session: a fresh id, a synchronous seq counter and an append queue that survives a rejected write. */
export default function createSession(): ProcessSession {
	let seq = 0;
	let tail: Promise<unknown> = Promise.resolve();

	return {
		sessionId: createSessionId({ now: new Date() }),
		pid: process.pid,
		startedRecorded: false,
		nextSeq: () => ++seq,
		enqueue: <T>(write: () => Promise<T>): Promise<T> => {
			// Run after the previous write settles, whether it resolved or rejected.
			const result = tail.then(write, write);
			tail = result.catch(() => undefined);
			return result;
		},
	};
}
