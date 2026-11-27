import { inputSchema, SCHEMA_VERSION } from "@/service/observer/event/shared/schema/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { RecordOutcome } from "@/service/observer/event/types/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import readPreviouslyEnded from "@/service/observer/event/record/readPreviouslyEnded/index.js";
import appendLine from "@/service/observer/event/record/appendLine/index.js";
import postToObserver from "@/service/observer/event/record/postToObserver/index.js";

/**
 * Record one pipeline event: validate it, stamp it, append it to this session's
 * log outside the project, then tell a running observer. An ended session is
 * not refused: the event is recorded and the outcome carries `previouslyEnded`
 * (the caller's conversation holds an ended mark) so the tool can tell the agent
 * to run the start check; recording never reopens (brief #121, #135). Every
 * outcome names the session id, so the tool can tag its reply (brief #90).
 *
 * It never throws: recording must never fail or slow the pipeline, so every
 * outcome is a value. The log comes first: the line is on disk before the
 * observer hears of it, so the log is the source of truth and the live view
 * is a best-effort copy. The post is still attempted when the append failed
 * (the reply then says `write-failed`), and it is capped by `postToObserver`.
 */
export default async function record({
	projectRoot,
	input,
}: {
	projectRoot: string;
	input: unknown;
}): Promise<RecordOutcome> {
	// 1. Session. Created before validation so every outcome, even `invalid`,
	// names it (brief #90).
	const session = getSession();
	const { sessionId } = session;

	// 2. Validate. Nothing is written or posted for an invalid input.
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) {
		const detail = parsed.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		return { logged: "invalid", delivered: false, sessionId, previouslyEnded: false, detail };
	}
	const event = parsed.data;

	// 3. Start the previously-ended read now; it runs beside the append and is
	// awaited only when the outcome is built, so it never delays a recording.
	const previouslyEnded = readPreviouslyEnded({ projectRoot, sessionId });

	// 4. One `session_started` per process; claim it before any further await
	// so two concurrent calls cannot both pass.
	if (event.kind === "session_started") {
		if (session.startedRecorded) return { logged: "repeat-session-start", delivered: false, sessionId, previouslyEnded: await previouslyEnded };
		session.startedRecorded = true;
	}

	// 5. Stamp. A seq is consumed even if the append then fails: a gap is
	// harmless, reusing a number is not.
	const stamped: ObserverEvent = {
		v: SCHEMA_VERSION,
		ts: new Date().toISOString(),
		sessionId: session.sessionId,
		seq: session.nextSeq(),
		pid: session.pid,
		...event,
	};

	// 6. Append first, one at a time in seq order.
	const appended = await session.enqueue(() => appendLine({ projectRoot, event: stamped }));

	// 7. Then notify the observer, whether or not the append succeeded.
	const delivered = await postToObserver({ projectRoot, event: stamped });

	// 8. Report.
	if (appended.written) return { logged: "written", delivered, sessionId, previouslyEnded: await previouslyEnded };
	return { logged: "write-failed", delivered, sessionId, previouslyEnded: await previouslyEnded, detail: appended.detail };
}
