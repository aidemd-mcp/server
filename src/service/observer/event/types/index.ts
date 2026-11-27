import type {
	ObserverEvent,
	SessionStartedEvent,
} from "@/service/observer/event/shared/schema/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";

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
	/**
	 * True when the calling session's conversation carries an ended mark of any
	 * kind; the tool then tells the agent to run the start check. Recording never
	 * reopens (brief commitments #121, #135). Always false for `invalid`.
	 */
	previouslyEnded: boolean;
	/** The id of the session this process records, on every outcome. */
	sessionId: string;
	/** The Zod issue summary (`invalid`) or the fs error code or message (`write-failed`). */
	detail?: string;
};

/** One session's liveness as `judgeLiveness` decides it (brief commitments #76, #96). */
export type SessionLiveness = {
	/** `ended` once an ended mark or a SessionEnd presence says so; otherwise the last hook state, or `working` for a session with no presence. */
	state: "working" | "waiting" | "ended";
	/** The newest of the presence time, the transcript's last write and the newest event time (ISO); null when there is none. */
	lastActivityAt: string | null;
	/** Whole minutes since `lastActivityAt`; 0 when it is null. */
	quietMinutes: number;
	/** True on a session that is not ended when it has been quiet longer than `SESSION_QUIET_LIMIT_MS`. */
	maybeStuck: boolean;
	/** Who ended the session: `hook`, `user` or `transcript`; present only when `state` is `ended`. */
	endedBy?: EndedMark["endedBy"];
};

/** One conversation as the event module groups it: its observer session ids and its Claude session ids, each ascending (brief commitments #132, #133). */
export type ConversationRef = {
	sessionIds: string[];
	claudeSessionIds: string[];
};

/** A conversation with the presence records that tie it together; event-internal. */
export type Conversation = ConversationRef & {
	presences: Presence[];
};

/** What `findConversation` reports for the start check's caller (brief commitments #129, #134). */
export type CallerConversation = ConversationRef & {
	/** The mark that decides the conversation's end, or null when none of its ids carries one. */
	mark: EndedMark | null;
	/** The conversation's start for the newer test, epoch ms: the greatest earlier session's start, else the caller's own; null when its id does not parse. */
	startedAt: number | null;
	/** True when another session of the project started after `startedAt`; computed only when `mark` is not null, else false. */
	newer: boolean;
};

/** What `markClosed` reports back: the transcript mark was written (keyed by `id`) or the conversation already carries a mark. */
export type MarkClosedOutcome = { outcome: "written"; id: string } | { outcome: "exists" };

/** What `reopen` reports back: the ended marks cleared (a count, 0 when there were none), or the first removal failure. */
export type ReopenOutcome = { outcome: "reopened"; cleared: number } | { outcome: "failed"; detail: string };

/** A hook presence that never linked to an observer session, with its liveness. */
export type UnlinkedPresence = {
	claudeSessionId: string;
	liveness: SessionLiveness;
};

/** What `readLiveness` reports: one liveness per asked session, and every unlinked presence (ended ones included). */
export type LivenessReport = {
	sessions: Record<string, SessionLiveness>;
	unlinked: UnlinkedPresence[];
};

/** One recorded session as `readSessionLog` returns it, before liveness is judged for the project. */
export type RawSessionLog = Omit<SessionLog, "liveness">;

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
	/** The session's liveness by the one rule (`readLiveness`): working, waiting or ended, with how long it has been quiet. */
	liveness: SessionLiveness;
	/** True when the file exists but could not be read. */
	unreadable: boolean;
};

/** What `deleteSession` reports back: it removes an archived session's log for good. */
export type DeleteOutcome = { outcome: "deleted" } | { outcome: "not-found" } | { outcome: "invalid-id"; detail: string };

/** What `archiveSession` reports back. */
export type ArchiveOutcome =
	| { outcome: "archived" }
	| { outcome: "not-found" }
	| { outcome: "live" }
	/** The session's file exists but could not be read, so its liveness cannot be judged and it was not archived. */
	| { outcome: "unreadable" }
	| { outcome: "invalid-id"; detail: string };

/** What `restoreSession` reports back; `restored` carries the session as `read` sees it. */
export type RestoreOutcome =
	| { outcome: "restored"; session: SessionLog }
	| { outcome: "not-found" }
	/** A log with that id already sits in the events folder, so nothing was moved. */
	| { outcome: "exists" }
	| { outcome: "invalid-id"; detail: string };

/** One project's recorded sessions as the listing returns them. */
export type ProjectLog = {
	/** The project's folder name under the app-data root. */
	projectKey: string;
	/** The root the project's newest session reported in `session_started`, exactly as reported; null when no session ever reported one. */
	projectRoot: string | null;
	/** The project's sessions, oldest first; never empty. */
	sessions: SessionLog[];
	/** Hook presence that links to none of the project's sessions, each with its liveness. */
	unlinked: UnlinkedPresence[];
};

/** The one session of this process: its identity, its seq counter and its append queue. */
export type ProcessSession = {
	/** Id shared by every event this process records; also the log file's stem. */
	sessionId: string;
	/** Process id stamped on every event, so a recorded event names the process that wrote it. */
	pid: number;
	/** True once a `session_started` event has been accepted in this process. */
	startedRecorded: boolean;
	/** Next seq: 1, 2, 3 ... Synchronous, so concurrent callers never share a number. */
	nextSeq: () => number;
	/** Runs `write` after every earlier queued write; a rejected write does not break the chain. */
	enqueue: <T>(write: () => Promise<T>) => Promise<T>;
};

/** The hook events that touch presence (brief commitment #78), derived from the presence schema so the two cannot drift. */
export type HookEventName = Presence["hookEvent"];

/** What one hook call hands `touchPresence` (brief commitments #72, #78, #92). */
export type TouchPresenceInput = {
	/** The project root the hook resolved (brief commitment #89). */
	projectRoot: string;
	/** The Claude Code session id from the hook input. */
	claudeSessionId: string;
	/** The hook that fired. */
	hookEvent: HookEventName;
	/** The state the hook maps to. */
	state: "working" | "waiting" | "ended";
	/** The hook's time, ISO UTC. */
	at: string;
	/** The hook input's `transcript_path`, when it carried one. */
	transcriptPath?: string;
	/** The observer session id the hook parsed from an `aide_observer_event` reply, when it did. */
	linkSessionId?: string;
	/** True when this hook ends the observer session as well (SessionEnd for a reason other than clear or resume). */
	endsObserverSession: boolean;
};

/** What `touchPresence` reports back; it never throws, so every outcome is a value. */
export type TouchOutcome = {
	/** True when the presence file now holds this call's record (false when unchanged or the write failed). */
	written: boolean;
	/** The observer session the merged presence links to, or null while unlinked. */
	linkedSessionId: string | null;
	/** What happened to the ended mark: written now, already there, or not attempted. */
	endedMark: "written" | "exists" | "none";
	/** True only when the running observer answered the ping with 2xx. */
	delivered: boolean;
	/** True when the call attempted a ping; false when it was skipped because nothing worth telling the observer changed. */
	pinged: boolean;
	/** The failure message when the presence write or the mark write failed. */
	detail?: string;
};

/** What `endSession` reports back; every refusal is a value, never a thrown error. */
export type EndSessionOutcome =
	| { outcome: "ended"; id: string }
	| { outcome: "already-ended"; id: string }
	/** The id is the caller's own observer session, or a Claude session linked to it. */
	| { outcome: "own-session"; id: string }
	/** No session, archived or not, and no presence of this project carries the id. */
	| { outcome: "unknown"; id: string }
	| { outcome: "invalid-id"; detail: string };
