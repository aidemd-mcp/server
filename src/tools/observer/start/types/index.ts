import type { RunningObserver } from "@/observer/types/index.js";
import type { Phase, SessionLiveness } from "@/types/index.js";

/** One port the start's pre-walk could not bind, with why (`in use`, `not allowed`, or the error code). */
export type PortTry = { port: number; reason: string };

/**
 * One other open session of the project, as the HALT names it (brief commitments #69, #82).
 * `idKind` says what `id` is: an observer session id, or the Claude session id of a presence that
 * never linked to one (then `pipeline` and `phase` are null, it has no log).
 */
export type OpenSession = {
	id: string;
	idKind: "session" | "claude";
	liveness: SessionLiveness;
	pipeline: string | null;
	phase: Phase | null;
};

/**
 * The three replies that carry the observer link of a session that may proceed: freshly started,
 * already running, or running but stuck on an older version. A reopen wraps one of these.
 */
export type LinkReply = Extract<StartReply, { outcome: "started" | "running" | "stuck" }>;

/** What starting the observer answered; `formatReply` turns it into the one line the skill branches on. */
export type StartReply =
	/** The observer was started; `replaced` is the version of an older observer it replaced. */
	| { outcome: "started"; link: string; replaced?: string }
	/** The observer was already running. */
	| { outcome: "running"; link: string }
	/** The running observer is older than this AIDE and did not shut down. */
	| { outcome: "stuck"; runningVersion: string; ownVersion: string; link: string }
	/** Another open session of the project: nothing proceeds until the user approves ending it. */
	| { outcome: "halt"; link: string; open: OpenSession[] }
	/** This session was ended earlier and is open again; `reply` is the link reply the start would have given. */
	| { outcome: "reopened"; reply: LinkReply }
	/** Hard stop: this session was ended (`user`: on the user's approval from another session; `newer`: a newer session has worked the project since), so it cannot reopen. */
	| { outcome: "stopped"; reason: "newer" | "user"; link: string }
	/** This session was ended earlier and the reopen failed; `detail` says why. */
	| { outcome: "reopen-failed"; detail: string; link: string }
	/** The observer could not start. */
	| { outcome: "blocked"; reason: string };

/** How waiting for the freshly spawned observer ended. */
export type AwaitOutcome =
	| { outcome: "answered"; observer: RunningObserver }
	| { outcome: "not-started"; reason: string };
