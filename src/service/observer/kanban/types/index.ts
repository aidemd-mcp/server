/** The on-disk column folder names of a project's board (brain kanban guide, `kanban/kanban.md`). */
export type BoardColumnId = "backlog" | "todo" | "in-progress" | "in-review" | "done";

/** What the newest session reported that the board needs: its kanban tag. Missing when not reported. */
export interface ReportedLocation {
	/** The project's kanban tag the session reported. */
	kanbanTag?: string;
}

/** Answer when the board cannot be located: the observer renders the reason, detail and hint. */
export interface BoardUnavailable {
	state: "unavailable";
	/**
	 * Why the board is unavailable. Each reason names the locating step that
	 * failed (observer brief commitment 110):
	 * - `no-brain-config`: the project has no `.aide/config/brain.aide` (`parseBrainAide` kind `missing`).
	 * - `brain-config-unreadable`: the config cannot be read (kind `unreadable`, `malformed-frontmatter` or `malformed-body`).
	 * - `no-kanban-field`: the config declares no `kanban` field, or its `kanban.path` is not filled in yet.
	 * - `kanban-field-malformed`: the `kanban` field is present but faulty (other than its source).
	 * - `unsupported-source`: `kanban.source` names a board kind other than `folder`.
	 * - `kanban-folder-missing`: the kanban folder is not an absolute path or is not a folder that exists.
	 * - `no-kanban-tag`: no session has reported a kanban tag.
	 * - `board-folder-missing`: the tag is not a single folder name, or its folder inside the kanban folder is missing.
	 *
	 * `board-read-failed` is set by a caller whose call to `board/read` threw (it
	 * violates this module's never-throw contract), with the error in `detail`, so
	 * the page never shows a folder as missing when the read itself broke.
	 */
	reason:
		| "no-kanban-tag"
		| "board-folder-missing"
		| "board-read-failed"
		| "no-brain-config"
		| "brain-config-unreadable"
		| "no-kanban-field"
		| "kanban-field-malformed"
		| "unsupported-source"
		| "kanban-folder-missing";
	/** Names the path or value that was checked. */
	detail: string;
	/** What the user can do about it: the reason's text from `shared/boardHints`. */
	hint: string;
}

/** One task on the board: either parsed from its note, or marked unreadable. */
export type BoardTask =
	| {
			state: "readable";
			/** The note's file name without `.md`. */
			slug: string;
			/** The column folder the note sits in. */
			column: BoardColumnId;
			/** The first `# ` heading of the note, else the slug. */
			title: string;
			/** The frontmatter priority; p2 when absent or unknown. */
			priority: "p0" | "p1" | "p2" | "p3";
			/** The frontmatter `type`, when a non-empty string. */
			type?: string;
			/** The frontmatter `tags` as strings. */
			tags: string[];
			/** The frontmatter `updated` as a string, when present. */
			updated?: string;
			/** True when the session record's `## Kanban` section names this slug. */
			inSession: boolean;
	  }
	| {
			state: "unreadable";
			/** The note's file name without `.md`. */
			slug: string;
			/** The column folder the note sits in. */
			column: BoardColumnId;
			/** Why the note could not be parsed or read. */
			reason: string;
			/** True when the session record's `## Kanban` section names this slug. */
			inSession: boolean;
	  };

/** One column of the board with its tasks. */
export interface BoardColumn {
	id: BoardColumnId;
	label: "Backlog" | "Todo" | "In Progress" | "In Review" | "Done";
	tasks: BoardTask[];
}

/** A located board: always five columns, in `BOARD_COLUMNS` order. */
export interface Board {
	state: "available";
	/** The project's kanban tag. */
	kanbanTag: string;
	/** Absolute path of the project's board folder. */
	boardFolder: string;
	columns: BoardColumn[];
}

/** Result of reading the board. */
export type BoardResult = Board | BoardUnavailable;

/** Result of reading one task. */
export type TaskReadResult =
	| {
			state: "found";
			slug: string;
			column: BoardColumnId;
			/** The note's full text exactly as stored. */
			markdown: string;
			task: BoardTask;
	  }
	| { state: "not-found"; slug: string }
	| { state: "refused"; slug: string; detail: string }
	| BoardUnavailable;
