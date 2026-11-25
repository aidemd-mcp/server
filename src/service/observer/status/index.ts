import describeError from "@/util/describeError/index.js";
import buildHistory from "./buildHistory/index.js";
import buildModuleNodes from "./buildModuleNodes/index.js";
import buildRails from "./buildRails/index.js";
import findRunningWork from "./findRunningWork/index.js";
import findWaitingFiles from "./findWaitingFiles/index.js";
import foldSessions from "./foldSessions/index.js";
import listWorkFiles from "./listWorkFiles/index.js";
import readSessionRecord from "./readSessionRecord/index.js";
import type { SessionRecord, Status, StatusInput, StatusPart, StatusProblem } from "./types/index.js";

/**
 * Builds the full Status the observer page shows: the tree of every AIDE file,
 * the plans/todos list, the session record, sessions with the liveness the
 * caller judged (passed through, never re-judged), running work, the files
 * awaiting the user and the one to surface, one pipeline rail per session that
 * has not ended (resumed from the archived sessions' events) and the history.
 * Files decide current state; events add only who, when, history and which
 * file to surface. Each part runs on its own: a part that throws is left empty
 * and reported in `problems`, and never fails another part. Reads only the
 * project's `.aide` files and writes nothing; never reads presence, logs or
 * the board.
 */
export default async function buildStatus({
	projectRoot,
	events,
	archivedEvents,
	liveness,
	board,
}: StatusInput): Promise<Status> {
	const now = Date.now();
	const problems: StatusProblem[] = [];

	/** Runs one part, returning its empty value and recording a problem when it throws. */
	async function runPart<T>({ part, empty, run }: { part: StatusPart; empty: T; run: () => T | Promise<T> }): Promise<T> {
		try {
			return await run();
		} catch (error) {
			problems.push({ part, message: describeError({ error }) });
			return empty;
		}
	}

	// Step 1: every AIDE file, grouped by module folder.
	const tree = await runPart({ part: "tree", empty: [], run: () => buildModuleNodes({ projectRoot }) });

	// Step 2: the flat plans/todos list, read from the tree.
	const workFiles = await runPart({ part: "tree", empty: [], run: () => listWorkFiles({ nodes: tree }) });

	// Step 3: the session record as raw markdown sections.
	const sessionRecord = await runPart<SessionRecord>({
		part: "sessionRecord",
		empty: { state: "unreadable", error: "session record could not be built" },
		run: () => readSessionRecord({ projectRoot }),
	});

	// Step 4: sessions folded from events, with the liveness the caller judged.
	const sessions = await runPart({ part: "sessions", empty: [], run: () => foldSessions({ events, liveness }) });

	// Step 5: running work, where files veto what events claim.
	const running = await runPart({
		part: "running",
		empty: [],
		run: () => findRunningWork({ projectRoot, events, sessions, nodes: tree, now }),
	});

	// Step 6: files awaiting the user; the newest one is surfaced.
	const waiting = await runPart({
		part: "waiting",
		empty: [],
		run: () => findWaitingFiles({ projectRoot, events, nodes: tree }),
	});
	const surfaced = waiting[0] ?? null;

	// Step 7: one rail per live session, resumed from the archived sessions' events.
	const rails = await runPart({
		part: "rail",
		empty: [],
		run: () => buildRails({ events, archivedEvents, sessions, running }),
	});

	// Step 8: one history row per event.
	const history = await runPart({ part: "history", empty: [], run: () => buildHistory({ events }) });

	// Step 9: the status, with the board passed through untouched.
	return {
		projectRoot,
		generatedAt: new Date(now).toISOString(),
		tree,
		workFiles,
		sessionRecord,
		sessions,
		running,
		waiting,
		surfaced,
		rails,
		history,
		board,
		problems,
	};
}
