import type {
	ObserverEvent,
	SessionStartedEvent,
} from "@/service/observer/event/shared/schema/index.js";

/** What `record` reports back; it never throws, so every outcome is a value. */
export type RecordOutcome = {
	/**
	 * What happened to the log line. `invalid`: the input failed `inputSchema`,
	 * nothing written or posted. `repeat-session-start`: a second
	 * `session_started` in this process, nothing written or posted.
	 * `write-failed`: the append failed. `written`: the line is on disk.
	 */
	logged: "written" | "write-failed" | "invalid" | "repeat-session-start";
	/** True only when the running observer answered 2xx. */
	delivered: boolean;
	/** The Zod issue summary (`invalid`) or the fs error code or message (`write-failed`). */
	detail?: string;
};

/** One recorded session as `read` returns it. */
export type SessionLog = {
	/** The session's id, the file name without `.jsonl`. */
	sessionId: string;
	/** The session's `session_started` event exactly as recorded, or null when the agent never reported one. */
	started: SessionStartedEvent | null;
	/** Every valid event in `seq` order, the `session_started` event included; empty when `unreadable`. */
	events: ObserverEvent[];
	/** Lines that were not valid events of this session and were skipped. */
	skippedLines: number;
	/** True while the session's highest-`seq` event's pid runs or that event is younger than `SESSION_IDLE_LIMIT_MS` (src/util/sessionIdleLimit). */
	live: boolean;
	/** True when the file exists but could not be read. */
	unreadable: boolean;
};

/** What `deleteSession` reports back. */
export type DeleteOutcome =
	| { outcome: "deleted" }
	| { outcome: "not-found" }
	| { outcome: "live" }
	/** The session's file exists but could not be read, so its liveness cannot be judged and it was not deleted. */
	| { outcome: "unreadable" }
	| { outcome: "invalid-id"; detail: string };

/** One project's recorded sessions as the listing returns them. */
export type ProjectLog = {
	/** The project's folder name under the app-data root. */
	projectKey: string;
	/** The root the project's newest session reported in `session_started`, exactly as reported; null when no session ever reported one. */
	projectRoot: string | null;
	/** The project's sessions, oldest first; never empty. */
	sessions: SessionLog[];
};

/** The one session of this process: its identity, its seq counter and its append queue. */
export type ProcessSession = {
	/** Id shared by every event this process records; also the log file's stem. */
	sessionId: string;
	/** Process id stamped on every event, so liveness can be judged from the log alone. */
	pid: number;
	/** True once a `session_started` event has been accepted in this process. */
	startedRecorded: boolean;
	/** Next seq: 1, 2, 3 ... Synchronous, so concurrent callers never share a number. */
	nextSeq: () => number;
	/** Runs `write` after every earlier queued write; a rejected write does not break the chain. */
	enqueue: <T>(write: () => Promise<T>) => Promise<T>;
};
