import type { AlignmentValue, WorkStatus, ObserverEvent, BoardResult } from "@/types/index.js";

/** The closed list of pipeline phases, derived from the event schema's `phase_started` event. */
export type Phase = Extract<ObserverEvent, { kind: "phase_started" }>["phase"];

/** What the status builder needs: the project, every recorded event and the board result. */
export type StatusInput = {
	/** Absolute path of the project root. */
	projectRoot: string;
	/** All recorded events of all sessions, deduplicated by the caller, in any order. */
	events: ObserverEvent[];
	/** The kanban board result, passed through to the status untouched. */
	board: BoardResult;
};

/** Checkbox counts from util `countCheckboxes`, the counter `aide_cleanup` uses. */
export type FileProgress = {
	/** Checked boxes (`total - open`). */
	done: number;
	/** Every checkbox in the file. */
	total: number;
	/** Unchecked boxes (`open.length`). */
	open: number;
};

/** A tree file that could not be read; only this entry is affected. */
type MalformedRead = { state: "malformed"; error: string };

/** One AIDE file in the tree. Discriminated on `kind`; `read` is the present shape or a malformed marker. */
export type TreeFileEntry =
	| {
			kind: "intent";
			/** Project-relative POSIX path of the file. */
			file: string;
			/** Node folder of the file, `"."` for the root. */
			folder: string;
			read:
				| {
						state: "present";
						/** The spec's alignment, or `"unset"` when it records none. */
						alignment: AlignmentValue | "unset";
						description: string;
						progress: FileProgress;
				  }
				| MalformedRead;
	  }
	| {
			kind: "brief" | "plan" | "todo";
			/** Project-relative POSIX path of the file. */
			file: string;
			/** Node folder of the file, `"."` for the root. */
			folder: string;
			read:
				| {
						state: "present";
						/** The file's work status, or `"unset"` when it records none. */
						status: WorkStatus | "unset";
						/** True when `status === "proposed"`. */
						awaitingApproval: boolean;
						progress: FileProgress;
						/** Numbered plan steps for a plan; equals the checkbox counts for a brief or todo. */
						steps: { done: number; total: number };
				  }
				| MalformedRead;
	  }
	| {
			kind: "research" | "session" | "other";
			/** Project-relative POSIX path of the file. */
			file: string;
			/** Node folder of the file, `"."` for the root. */
			folder: string;
			read: { state: "present"; progress: FileProgress } | MalformedRead;
	  };

/** The kind of an AIDE file in the tree. */
export type TreeFileKind = TreeFileEntry["kind"];

/** One folder of the tree with the AIDE files it holds. */
export type ModuleNode = {
	/** Project-relative POSIX folder, `"."` for the project root (whose files live in `.aide/`). */
	folder: string;
	/** The nearest ancestor node folder, or null for the root. */
	parent: string | null;
	files: TreeFileEntry[];
};

/** A plan or todo entry, as listed in the flat plans/todos list. */
export type WorkFileEntry = Extract<TreeFileEntry, { kind: "brief" | "plan" | "todo" }> & { kind: "plan" | "todo" };

/** The session record (`.aide/session.aide`) as raw markdown sections; rendering is the page's job. */
export type SessionRecord =
	| { state: "missing" }
	| { state: "unreadable"; error: string }
	| {
			state: "present";
			intent: string;
			/** The unnamed leading section before the first `## ` heading. */
			preamble: string;
			sections: {
				heading: string;
				/** Raw text before the section's first `### ` heading. */
				markdown: string;
				subsections: { heading: string; markdown: string }[];
			}[];
	  };

/** Whether a session is still active: `live` (recent event), `idle` (older, pid running) or `ended`. */
export type Liveness = "live" | "idle" | "ended";

/** One session folded from its events. */
export type SessionSummary = {
	sessionId: string;
	/** `ts` of the lowest-seq event. */
	startedAt: string;
	/** `ts` of the highest-seq event. */
	lastEventAt: string;
	eventCount: number;
	/** The pid of the highest-seq event. */
	pid: number;
	liveness: Liveness;
	/** What the first `session_started` event reported (only the keys it carried), or null. */
	reported: { projectRoot?: string; kanbanTag?: string; brainPath?: string } | null;
};

/** One phase running now in a live or idle session. */
export type RunningWork = {
	sessionId: string;
	phase: Phase;
	agent: string;
	module: string;
	startedAt: string;
	elapsedMs: number;
	/** Build only: the step reached of the plan's numbered steps, read from the plan file. */
	buildStep?: { reached: number; total: number };
	/** QA or Fix only: the round of the QA to Fix loop. */
	qaFixRound?: number;
};

/** One file named by an open `gate_waiting` event that still awaits approval. */
export type WaitingFile = {
	/** Project-relative POSIX path. */
	file: string;
	folder: string;
	kind: TreeFileKind;
	gate: string;
	sessionId: string;
	seq: number;
	/** The `ts` of the `gate_waiting` event. */
	since: string;
};

/** Where a phase stands on the rail. */
export type RailPhaseState = "running" | "done" | "not-run";

/** One phase of the closed list on the rail. */
export type RailPhase = {
	phase: Phase;
	label: string;
	state: RailPhaseState;
	/** Only on the `running` entry, copied from the running work. */
	buildStep?: RunningWork["buildStep"];
	/** Only on the `running` entry, copied from the running work. */
	qaFixRound?: RunningWork["qaFixRound"];
};

/**
 * The phase rail for one module. Built only from reported events (the phase
 * running now and the phases finished in that session for that module); never
 * from files, never a next step.
 */
export type PhaseRail = {
	module: string;
	sessionId: string;
	/** Whether the module came from the running work or from the surfaced file. */
	source: "running" | "surfaced";
	/** Every phase of the closed list exactly once, in list order. */
	phases: RailPhase[];
};

/** One history row: exactly one per recorded event. */
export type HistoryRow = {
	sessionId: string;
	seq: number;
	ts: string;
	kind: ObserverEvent["kind"];
	/** One line describing the event. */
	label: string;
	detail?: { text?: string; file?: string; slug?: string };
};

/** The parts of the status that can fail independently. */
export type StatusPart = "tree" | "sessionRecord" | "sessions" | "running" | "waiting" | "rail" | "history";

/** A part that failed and was emptied. */
export type StatusProblem = { part: StatusPart; message: string };

/** Everything the observer page shows. */
export type Status = {
	projectRoot: string;
	/** ISO-8601 UTC time the status was built. */
	generatedAt: string;
	tree: ModuleNode[];
	workFiles: WorkFileEntry[];
	sessionRecord: SessionRecord;
	sessions: SessionSummary[];
	running: RunningWork[];
	/** Every open waiting file that still awaits approval, newest first. */
	waiting: WaitingFile[];
	/**
	 * The one file the page opens as if the user clicked it in the tree, or
	 * null (brief commitment #25). Status only names it; when to open it is the
	 * page's decision.
	 */
	surfaced: WaitingFile | null;
	rail: PhaseRail | null;
	history: HistoryRow[];
	board: BoardResult;
	problems: StatusProblem[];
};
