import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverEvent, ProjectLog, SessionLiveness, Status } from "@/types/index.js";

/** Envelope of every JSON body the observer sends: data on success, an error otherwise, never both. */
export type ApiResponse<T> =
	| { data: T; error?: never }
	| { data?: never; error: { message: string; details?: string } };

/** The observer found running: where it listens, the port that address names, the token it answers to, its process and the version of the code running. */
export type RunningObserver = { address: string; port: number; token: string; pid: number; version: string };

/**
 * What takeOver answers: no observer ran, an older one was replaced, a same-or-newer (or
 * unparseable-version, or refusing) one is kept, or an older one that will not exit is stuck.
 */
export type TakeOver =
	| { outcome: "none" }
	| { outcome: "replaced"; previous: RunningObserver }
	| { outcome: "kept"; observer: RunningObserver }
	| { outcome: "stuck"; observer: RunningObserver };

/**
 * What startObserver answers: started now (with the stop and its completion signal), a same-or-newer
 * observer kept, an older one that will not exit (stuck), or not started with the reason.
 */
export type StartResult =
	| { outcome: "started"; observer: RunningObserver; stop: () => Promise<void>; stopped: Promise<void> }
	| { outcome: "kept"; observer: RunningObserver }
	| { outcome: "stuck"; observer: RunningObserver }
	| { outcome: "not-started"; reason: string };

/** One session as the observer holds it in memory, filed under the project it was first seen under, events in seq order. */
export type HeldSession = { projectKey: string; sessionId: string; events: ObserverEvent[] };

/**
 * The in-memory event store: holds posts during replay, then dedupes on (sessionId, seq).
 * Each session belongs to the project key it was first seen under; a post under another key is
 * a `project-mismatch` and stores nothing.
 */
export type EventStore = {
	accept(input: { event: ObserverEvent; projectKey: string }): "held" | "added" | "duplicate" | "project-mismatch";
	finishReplay(projects: ProjectLog[]): void;
	isReady(): boolean;
	sessions(input?: { projectKey?: string }): HeldSession[];
	drop(input: { projectKey: string; sessionId: string }): boolean;
};

/** Names of the server-sent-event frames the stream sends. */
export type StreamMessageName = "snapshot" | "aide-event" | "status" | "sessions" | "projects";

/**
 * The server-sent-event hub: subscribe a client (optionally for one project), broadcast a frame
 * (optionally for one project, or only to the clients with no project filter), close everything.
 */
export type StreamHub = {
	subscribe(input: { res: ServerResponse; snapshot: { sessions: HeldSession[] }; projectKey?: string }): void;
	broadcast(input: { name: StreamMessageName; data: unknown; projectKey?: string; unfilteredOnly?: boolean }): void;
	closeAll(): void;
	size(): number;
};

/**
 * Everything a route handler may touch; built once per observer by startObserver. The observer has
 * no project root of its own: each project's root comes from its newest session. `brainOverride`
 * is the `--brain` path and applies to the one project it names.
 */
export type ObserverContext = {
	port: number;
	token: string;
	/** The running AIDE package version; the shutdown request compares the caller's version against it. */
	version: string;
	brainOverride?: { projectKey: string; brainPath: string };
	store: EventStore;
	hub: StreamHub;
	statusPusher: { push(projectKey: string): void };
	/** Stops the observer; the shutdown route calls it once its response has finished. */
	shutdown: () => void;
	/** Epoch milliseconds, the unit readLiveness takes. */
	now: () => number;
};

/** The one argument every route handler receives. */
export type RouteInput = {
	req: IncomingMessage;
	res: ServerResponse;
	url: URL;
	params: Record<string, string>;
	ctx: ObserverContext;
};

/** A route handler answers through `res`; a throw becomes a 500 in handleRequest. */
export type RouteHandler = (input: RouteInput) => Promise<void>;

/** One row of GET /api/sessions (named apart from status's own SessionSummary). */
export type SessionListing = {
	sessionId: string;
	startedAt: string | null;
	metadata: { projectRoot?: string; kanbanTag?: string; brainPath?: string } | null;
	eventCount: number;
	lastEventAt: string | null;
	/** The recording side's judgement (event's readLiveness): working, waiting or ended, with how long it has been quiet. */
	liveness: SessionLiveness;
};

/** One port value parsed by the shared rule: the number, or why it is unusable. */
export type PortParse = { ok: true; port: number } | { ok: false; reason: string };

/** The port a start will bind and where it came from, or why the requested value is unusable. */
export type PortChoice =
	| { ok: true; port: number; source: "flag" | "env" | "default" }
	| { ok: false; reason: string };

/** One project's view: the built status, or the reason no status can be built because no session reported a root. */
export type ProjectView =
	| { state: "ready"; projectKey: string; status: Status }
	| { state: "no-project-root"; projectKey: string; detail: string };

/** What findProject answers: no held session under the key, or the project with its sessions and the root its newest session reported. */
export type ProjectLookup =
	| { kind: "missing" }
	| { kind: "found"; projectKey: string; projectRoot: string | null; sessions: HeldSession[] };

/** One row of GET /api/projects: a project with the root its newest session reported (null when none did), its sessions and the time of its latest event. */
export type ProjectListing = {
	projectKey: string;
	projectRoot: string | null;
	sessions: SessionListing[];
	lastEventAt: string | null;
};

/** What the observer start commands tell the caller; `note` is the parenthetical a started line may carry. */
export type ObserverMessage =
	| { kind: "started"; link: string; note?: string }
	| { kind: "already-running"; link: string }
	| { kind: "stuck"; runningVersion: string; ownVersion: string; link: string }
	| { kind: "not-started"; reason: string };
