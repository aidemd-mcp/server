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

/** What starting the observer answered; `formatReply` turns it into the one line the skill branches on. */
export type StartReply =
	| { outcome: "started"; link: string; replaced?: string }
	| { outcome: "running"; link: string }
	| { outcome: "stuck"; runningVersion: string; ownVersion: string; link: string }
	| { outcome: "halt"; link: string; open: OpenSession[] }
	| { outcome: "blocked"; reason: string };

/** How waiting for the freshly spawned observer ended. */
export type AwaitOutcome =
	| { outcome: "answered"; observer: RunningObserver }
	| { outcome: "not-started"; reason: string };
