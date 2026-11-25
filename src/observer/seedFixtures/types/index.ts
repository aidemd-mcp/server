import type { AlignmentValue, WorkStatus } from "@/types/index.js";
import type { ObserverEventInput } from "@/service/observer/event/shared/schema/index.js";
import type { BoardColumnId, BoardTask } from "@/service/observer/kanban/types/index.js";

/** One event of a fixture session: the agent-supplied fields only (the writer stamps the envelope) and its age. */
export type FixtureEvent = { offsetMin: number } & ObserverEventInput;

/** The hook presence a fixture session carries: the state its last hook call mapped to, and how long ago that call was. */
export type FixturePresence = { state: "working" | "waiting" | "ended"; minutesAgo: number };

/** One recorded session; `offsetMin` of each event is minutes before `now`, larger meaning older. */
export type FixtureSession = {
	/** `live` stamps the seeding process's own pid on every event; `dead` stamps a pid that has already exited. */
	pid: "live" | "dead";
	events: FixtureEvent[];
	/** The presence file the session's hooks left; none leaves the session without one. */
	presence?: FixturePresence;
	/** True writes an ended mark (`endedBy: "user"`) for the session. */
	ended?: boolean;
};

/** Which cut of the handoff's history the timeline returns; each names the last event the cut keeps. */
export type TimelineCut = "none" | "plan" | "wait" | "build" | "idle" | "fix";

/** One kanban task written as a note under the fixture brain. */
export type FixtureTask = {
	column: BoardColumnId;
	slug: string;
	title: string;
	priority: Extract<BoardTask, { state: "readable" }>["priority"];
	type: string;
	/** The frontmatter `updated` stamp (an ISO time); left out when the note carries none. */
	updated?: string;
	/** The note body; defaults to `# <title>`. */
	markdown?: string;
};

/** One fixture project: its files, its board, and the sessions recorded for it. */
export type FixtureProject = {
	/** The project root's folder name (the project key is derived from it and its path). */
	folderName: string;
	/** True when `files` are written under the root; false leaves the root without any AIDE files. */
	installed: boolean;
	/** Project files by root-relative path. */
	files: Record<string, string>;
	/** The board to write, a board whose brain folder is never created, or no board at all. */
	board:
		| { kanbanTag: string; tasks: FixtureTask[] }
		| { kanbanTag: string; missingBrain: true }
		| null;
	/** False makes the sessions' `session_started` events report no project root. */
	reportRoot: boolean;
	sessions: FixtureSession[];
};

/** A module's `plan.aide`: its status and how many of its numbered steps are checked. */
export type FixturePlan = { status: WorkStatus; done: number; total: number };

/** A module's `todo.aide`: `proposed` while items are open, else `completed`; `open` of `total` items unchecked. */
export type FixtureTodo = { status: "proposed" | "completed"; open: number; total: number };

/** The plan and todo list the `src/tools/score` module carries in a scenario; null leaves the file out. */
export type ScoreWork = { plan: FixturePlan | null; todo: FixtureTodo | null };

/** One module of the handoff's sample project, written as an intent spec and the files its flags name. */
export type FixtureModule = {
	/** Project-relative folder; the empty string is the project root. */
	path: string;
	desc: string;
	alignment: AlignmentValue;
	brief?: true;
	research?: true;
	plan?: FixturePlan;
	todo?: FixtureTodo;
};

/** The session record variants the handoff draws (`building` also serves the scenarios in the plan and wait phases). */
export type SessionRecordVariant = "building" | "waiting" | "idle" | "noEvents" | "qaFix";

/** Which catalog of scenarios the QA observer is seeded with: the session pages, the Home screen's five projects, or Home with twelve. */
export type FixtureSet = "sessions" | "home" | "home-many";

/** One QA scenario: a labelled project. */
export type FixtureScenario = {
	id: string;
	label: string;
	project: FixtureProject;
};

/** What `seedFixtures` wrote: per scenario, where the project lives and which sessions were recorded. */
export type SeededFixtures = {
	scenarios: {
		id: string;
		label: string;
		projectKey: string;
		sessionIds: string[];
		projectRoot: string;
	}[];
};
