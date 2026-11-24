import type {
	ApiResponse,
	HeldSession,
	ProjectListing,
	ProjectView,
	SessionListing,
} from "@/observer/types/index.js";
import type {
	AlignmentValue,
	BoardColumnId,
	BoardTask,
	Liveness,
	ObserverEvent,
	PhaseRail,
	RailPhase,
	SessionRecord,
	Status,
	WaitingFile,
	WorkStatus,
} from "@/types/index.js";

/** The `ApiResponse` envelope the observer sends, re-exported so page code names it from one place. */
export type { ApiResponse };

/** The session view's tabs; `history` is the phone-only one (on desktop it shows the tree beside the history panel). */
export type SessionTab = "tree" | "plans" | "board" | "record" | "sessions" | "history";

/** What the drawer shows, as a link carries it (`?item=`). */
export type DrawerItem =
	| { kind: "module"; folder: string }
	| { kind: "task"; slug: string }
	| { kind: "file"; path: string }
	| { kind: "event"; sessionId: string; seq: number };

/** A page URL that opens Home. */
export type HomeRoute = { kind: "home"; token: string };

/** A page URL that opens one session's view, on one tab, with or without a detail open. */
export type SessionRoute = {
	kind: "session";
	token: string;
	projectKey: string;
	sessionId: string;
	tab: SessionTab;
	item: DrawerItem | null;
};

/** What the address bar asks for; `invalid` is any address the page cannot serve, including one with no token. */
export type PageRoute = HomeRoute | SessionRoute | { kind: "invalid" };

/** The part of the observer's rail the page draws from: the module and its phases, with nothing running. */
export type IdleRail = Pick<PhaseRail, "module" | "sessionId" | "phases">;

/** What `buildHref` writes a page link from: Home, or a session with its optional tab and detail. */
export type HrefTarget = { token: string } & (
	| { kind: "home" }
	| { kind: "session"; projectKey: string; sessionId: string; tab?: SessionTab; item?: DrawerItem | null }
);

/** The page theme. */
export type Theme = "dark" | "light";

/** What `ThemeRoot` hands every screen below it: the current theme and the toggle. */
export type ThemeContextValue = { theme: Theme; toggle(): void };

/** One block of the page's small markdown: a paragraph, or a bulleted or numbered list of item texts. */
export type MarkdownBlock = { type: "p"; text: string } | { type: "ul" | "ol"; items: string[] };

/** One run of inline markdown: plain text, `**bold**`, or `` `code` ``. */
export type InlineNode = { type: "text" | "bold" | "code"; text: string };

/** What a session row prints besides its raw counts: the start label, the span, the task line and the liveness badge. */
export type SessionRowDescription = {
	startLabel: string;
	duration: string;
	task: string | null;
	ended: boolean;
	live: boolean;
	badge: { className: "run" | "outline" | "neutral"; icon: IconName; word: "Live" | "Idle" | "Ended" };
};

/** Where a fetch stands: still loading, the data, or the observer's message. */
export type Fetched<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; message: string };

/** The connection pill's three states. */
export type ConnState = "live" | "idle" | "recon";

/** The handoff's icon names (`.ic.i-<name>` in viewer.css). */
export type IconName =
	| "run"
	| "wait"
	| "done"
	| "check"
	| "fail"
	| "issues"
	| "todo"
	| "chev-r"
	| "chev-d"
	| "sun"
	| "moon"
	| "trash"
	| "file"
	| "files"
	| "commit"
	| "prompt"
	| "task"
	| "flag"
	| "gate"
	| "error"
	| "tag"
	| "power"
	| "reconnect"
	| "unlink"
	| "folder"
	| "folder-off"
	| "search"
	| "close"
	| "clock"
	| "loop"
	| "step"
	| "move"
	| "cloud-off"
	| "pin"
	| "list"
	| "tree"
	| "board"
	| "doc"
	| "history"
	| "sessions"
	| "idle"
	| "eye";

/** What an API call gives back: the data, or the status and the observer's message. Never thrown. */
export type ApiResult<T> =
	| { ok: true; data: T }
	| { ok: false; status: number; message: string; details?: string };

/** Where the live stream stands. */
export type ConnectionState = "connecting" | "live" | "reconnecting" | "not-found" | "unauthorized";

/** One frame of the observer's stream, parsed. */
export type StreamFrame =
	| { name: "snapshot"; data: { sessions: HeldSession[] } }
	| { name: "aide-event"; data: { projectKey: string; event: ObserverEvent } }
	| { name: "status"; data: { projectKey: string; view: ProjectView } }
	| { name: "sessions"; data: { projectKey: string; sessions: SessionListing[] } }
	| { name: "projects"; data: { projects: ProjectListing[] } };

/** The slice of `EventSource` the page's stream connection uses, so tests can stand in a fake. */
export type StreamSource = {
	onopen: ((event: Event) => void) | null;
	onerror: ((event: Event) => void) | null;
	addEventListener(name: string, listener: (event: { data: string }) => void): void;
	close(): void;
};

/** What the stream reducer takes: a frame, or a change of connection. */
export type StreamAction = StreamFrame | { name: "connection"; state: ConnectionState };

/** Everything the page holds from the stream. */
export type StreamState = {
	connection: ConnectionState;
	held: HeldSession[];
	views: Record<string, ProjectView>;
	listings: Record<string, SessionListing[]>;
	projects: ProjectListing[] | null;
};

/** One tree node that holds at least one AIDE file, with each file's reported status; file fields are project-relative paths. */
export type ModuleRow = {
	folder: string;
	label: string;
	description: string | null;
	alignment: AlignmentValue | null;
	intentFile: string | null;
	brief: string | null;
	plan: { file: string; status: WorkStatus | "unset"; done: number; total: number } | null;
	todo: { file: string; open: number; total: number } | null;
	research: string | null;
	malformed: string[];
};

/** What an intent spec says about the module's alignment; a module with no readable intent spec has none. */
export type TreeAlignment = "aligned" | "unreviewed" | "misaligned";

/** The tone of a file chip: the handoff's `av-chip` modifiers; `""` is the plain chip. */
export type ChipTone = "" | "warn" | "run" | "done" | "muted" | "danger";

/** One file chip under a tree node (`brief`, `plan · approved 3/9`, `todo 2 open of 4`), its key and value already worded. */
export type FileChipModel = {
	kind: "brief" | "research" | "plan" | "todo";
	tone: ChipTone;
	icon: IconName;
	key: string;
	value: string | null;
	/** The project-relative file the chip stands for. */
	file: string;
};

/** One module of the intent tree as drawn: its path, spec facts, chips, and where it stands under the current collapse. */
export type TreeNodeModel = {
	folder: string;
	/** What the node prints: `.aide/intent.aide` for the root, else the folder. */
	path: string;
	/** The indent step, `d<n>`; capped at 4. */
	depth: 0 | 1 | 2 | 3 | 4;
	description: string | null;
	alignment: TreeAlignment | null;
	chips: FileChipModel[];
	/** `Working now · Build`, `Waiting on you` or `Last worked on` on the current module, else null. */
	current: string | null;
	misaligned: boolean;
	hasChildren: boolean;
	collapsed: boolean;
	/** How many modules a collapsed node hides below it; 0 when it is open or a leaf. */
	hiddenCount: number;
};

/** A tree node before any collapse or filter: where it sits and what it holds. */
export type TreeEntry = Omit<TreeNodeModel, "collapsed" | "hiddenCount"> & {
	/** Every folder above it in the tree, nearest last; a collapsed one hides it. */
	ancestors: string[];
	/** How many modules sit below it, at any depth. */
	descendants: number;
	/** An open todo, or a plan proposed or approved. */
	openWork: boolean;
};

/** The intent tree's data: every node in tree order, the totals the count line states, and the folders that start collapsed. */
export type TreeData = {
	kind: "tree";
	entries: TreeEntry[];
	counts: { modules: number; misaligned: number; openWork: number };
	initialCollapsed: string[];
};

/** One module in tree order with where it sits: the folders above it and how many modules are below it. */
export type FlatModule = { module: ModuleRow; ancestors: string[]; descendants: number; hasChildren: boolean };

/** What the tree tab draws: the tree, or the calm notice for a project that never reported its folder. */
export type TreePanelModel = TreeData | { kind: "unavailable" };

/** What the user has done to the tree tab: the path filter, the two toggles and the folded folders. It lives above the tab panel so it survives a tab switch. */
export type TreeView = {
	query: string;
	onlyOpen: boolean;
	onlyMisaligned: boolean;
	collapsed: ReadonlySet<string>;
};

/** What the Sessions tab's delete flow is doing: the one row asking for confirmation (null when none is) and the reason its last delete failed. It lives above the tab panel so it survives a tab switch. */
export type DeleteConfirm = { sessionId: string | null; error: string | null };

/** One row of the plans and todos table; `tone` and `icon` paint its status badge and `percent` its bar. */
export type PlanRowModel = {
	module: string;
	kind: "plan" | "todo";
	status: string;
	tone: "warn" | "run" | "done" | "outline" | "danger";
	icon: IconName;
	progress: string;
	percent: number;
	/** The current module's rows are highlighted. */
	highlighted: boolean;
	item: DrawerItem;
};

/** One task card on the board: its title and slug, the priority and type worded, whether this session picked it, and why the note was unreadable (null when it was read). */
export type TaskCardModel = {
	slug: string;
	title: string;
	priority: "p0" | "p1" | "p2" | "p3" | null;
	type: string | null;
	linked: boolean;
	unreadable: string | null;
};

/** One board column: every task in display order, how many the column holds, and how many show before `Show all`. */
export type BoardColumnModel = { id: BoardColumnId; name: string; total: number; tasks: TaskCardModel[]; cap: number };

/** The board as the Board tab draws it: five columns with their count line, or the notice that says why there is none. */
export type BoardModel =
	| { kind: "board"; columns: BoardColumnModel[]; countLine: string }
	| { kind: "unavailable"; tone: "calm" | "err"; heading: string; text: string; meta: string | null };

/** Where a rail cell stands; `todo` is a phase no event has reported (the handoff's dashed cell). */
export type RailCellState = "todo" | "run" | "wait" | "done" | "fail";

/** One of the rail's nine cells, every field already worded; `loop` is the `round <r>` badge on a running Fix, else null. */
export type RailCell = { name: string; state: RailCellState; meta: string; loop: string | null };

/** One side lane (Structure, Align, Refactor, Cleanup), worded the same way. */
export type LaneCell = {
	name: "Structure" | "Align" | "Refactor" | "Cleanup";
	state: "todo" | "run" | "done" | "fail";
	meta: string;
};

/** The phase rail as the page draws it: nine cells, four lanes and the module they describe (null when no event names one). */
export type RailView = { phases: RailCell[]; lanes: LaneCell[]; module: string | null };

/** What a cell says about itself before it is given its name. */
export type RailCellDescription = Omit<RailCell, "name">;

/** The nine cells of the rail, in order: the phases that run on the main line plus Plan approval and Done, which no phase names. */
export type RailSlot = "spec" | "research" | "synthesize" | "plan" | "approval" | "build" | "qa" | "fix" | "done";

/** What every cell is read from: the rail's phases for one module, the events of the rail's session that name it, and the clock. */
export type RailContext = {
	phases: RailPhase[];
	/** The rail's module, project-relative (`.` for the root). */
	module: string;
	sessionId: string;
	projectRoot: string;
	status: Status | null;
	/** Every event of the rail's session, oldest first. */
	sessionEvents: ObserverEvent[];
	/** The events of `sessionEvents` that name `module`. */
	moduleEvents: ObserverEvent[];
	now: Date;
};

/** One labelled value on the now card's line (`agent aide-qa`); `mono` is for paths, slugs and agent names. */
export type NowCardPart = { label: string; value: string; mono: boolean };

/** The build step bar and the step it stands on: `total` segments, `done` finished, `running` under way, `text` the plan's own words for it (null until loaded). */
export type NowCardSteps = { total: number; done: number; running: number; head: string; text: string | null };

/** The now card in one of its five states, every field already worded; the component only lays it out. */
export type NowCardModel = {
	kind: "run" | "wait" | "fix" | "idle" | "empty";
	state: string;
	icon: IconName;
	title: string;
	titleMono: string | null;
	sub: string | null;
	parts: NowCardPart[];
	time: string | null;
	timeLabel: string | null;
	steps: NowCardSteps | null;
	hint: string | null;
};

/** The tone of a badge in the page's own words: the handoff's `av-badge` modifiers. */
export type BadgeTone = PlanRowModel["tone"];

/** One section of the drawer: its heading with icon and optional badge, then one body type. */
export type DrawerBlockModel = {
	heading: string;
	icon: IconName;
	badge: { text: string; tone: BadgeTone } | null;
} & (
	| { type: "fm"; rows: { key: string; value: string; list: string[] | null }[] }
	| { type: "text"; paras: string[] }
	| { type: "list"; items: string[] }
	| { type: "pre"; text: string }
	| { type: "kv"; rows: { key: string; value: string; mono: boolean }[] }
	| { type: "check"; items: { no: string; text: string; done: boolean; sub: boolean; current: boolean }[] }
	| { type: "issues"; items: { loc: string; text: string; done: boolean }[] }
);

/** The drawer as drawn: its kind word, title (mono for a path, slug or version), meta line and blocks. */
export type DrawerModel = { kind: string; title: string; titleMono: boolean; meta: string | null; blocks: DrawerBlockModel[] };

/** What the drawer reads besides its item: how to reach the observer, the project's status and held events, and the session the view follows. */
export type DrawerContext = {
	token: string;
	projectKey: string;
	status: Status | null;
	events: ObserverEvent[];
	sessions: SessionRowModel[];
	focus: string;
	now: Date;
};

/** The AIDE files of one module that the module drawer reads; null where the module lists none. `brief` is read only when a brief was opened. */
export type ModuleFiles = { spec: string | null; plan: string | null; todo: string | null; brief: string | null };

/** The file a drawer block is built from; `file` is any file the module drawer does not draw. */
export type DrawerFileRole = keyof ModuleFiles | "file";

/** What an item needs fetched before its drawer can be built. */
export type DrawerFetchPlan =
	| { type: "none" }
	| { type: "files"; files: { role: DrawerFileRole; path: string }[] }
	| { type: "task"; slug: string };

/** One kanban task as the observer serves it. */
export type TaskNote = { slug: string; column: BoardColumnId; markdown: string; task: BoardTask };

/** What a `DrawerFetchPlan` fetched: the texts by role, or the task. */
export type DrawerSource =
	| { type: "none" }
	| { type: "files"; texts: Partial<Record<DrawerFileRole, string>> }
	| { type: "task"; note: TaskNote };

/** Which of a module's files an opened file stands for; it decides which block leads the module drawer. */
export type ModuleFileKind = "spec" | "plan" | "todo" | "brief";

/** One session as the sessions list draws it. */
export type SessionRowModel = {
	sessionId: string;
	startedAt: string;
	lastEventAt: string | null;
	eventCount: number;
	liveness: Liveness;
	task: string | null;
	label: string | null;
};

/** One checklist line of a plan or todo file. */
export type ChecklistItem = {
	number: string | null;
	text: string;
	loc: string | null;
	done: boolean;
	sub: boolean;
};

/** A spec file read for the drawer, or the error that stopped the read. */
export type SpecView =
	| {
			scope: string;
			intent: string;
			desired: string[];
			undesired: string[];
			sections: { heading: string; markdown: string }[];
	  }
	| { error: string };

/** A session record that was read: the only state the outline and the sections are built from. */
export type PresentSessionRecord = Extract<SessionRecord, { state: "present" }>;

/** One `##` section of the session record as the Record tab draws it. `empty` is the calm text to show when the section holds nothing, else null. */
export type RecordSection = {
	id: string;
	heading: string;
	markdown: string;
	subsections: { heading: string; markdown: string }[];
	empty: string | null;
};

/** One jump link of the record outline; `count` is the list-item count as text, blank when there is none (or for the pinned section). */
export type RecordOutlineEntry = { id: string; label: string; pinned: boolean; count: string };

/** The Record tab: why there is no record, or the outline, the pinned "Where this cycle stopped" section and the others. */
export type RecordModel =
	| { kind: "missing" | "unreadable"; message: string }
	| { kind: "present"; outline: RecordOutlineEntry[]; pinned: RecordSection | null; sections: RecordSection[] };

/** One open waiting file on Home's amber card: who waits, on what, for how long, and the link that opens that file's session. */
export type WaitCardModel = {
	key: string;
	project: string;
	file: string;
	module: string;
	since: string;
	at: string;
	href: string;
};

/** One live or idle session on Home: its project, start, what it is doing now (the badge), and the link to its view. */
export type LiveRowModel = {
	key: string;
	project: string;
	start: string;
	badge: { word: string; className: "run" | "wait" | "neutral"; icon: IconName };
	module: string | null;
	agent: string | null;
	elapsed: string | null;
	href: string;
};

/** One project on Home: its header facts, its sessions, and the link to its newest session (null with none). */
export type ProjectRowModel = {
	projectKey: string;
	name: string;
	root: string | null;
	kanbanTag: string | null;
	liveCount: number;
	waiting: boolean;
	/** The time of the project's newest event, what Home sorts projects by. */
	lastEventAt: string | null;
	/** `lastEventAt` as the row prints it (`3h ago`). */
	lastActivity: string | null;
	rows: SessionRowModel[];
	openHref: string | null;
};

/** What Home shows: the header line and pill, the waiting cards, the live sessions, and every project. */
export type HomeModel = {
	subtitle: string;
	conn: ConnState;
	empty: boolean;
	filterable: boolean;
	waits: WaitCardModel[];
	live: LiveRowModel[];
	projects: ProjectRowModel[];
};

/** The kind of a history row; it picks the glyph, the screen-reader word and the colour (`k-<kind>`). `files` is a group of file writes, `sub` one path inside it. */
export type HistoryKind =
	| "start"
	| "prompt"
	| "task"
	| "phase"
	| "done"
	| "wait"
	| "approve"
	| "step"
	| "issues"
	| "pass"
	| "commit"
	| "release"
	| "error"
	| "files"
	| "sub";

/** The groups the history's type filters count and keep; `sessions` is counted but has no filter. */
export type HistoryCategory = "phases" | "gates" | "qa" | "tasks" | "files" | "commits" | "prompts" | "errors" | "sessions";

/** One history row as drawn, every field already worded; `files` holds the group of file writes folded under it (a `files` row holds its `sub` rows). */
export type HistoryRowModel = {
	id: string;
	sessionId: string;
	/** `HH:MM`; empty on the rows of a file group, which carry no time of their own. */
	time: string;
	day: string;
	kind: HistoryKind;
	category: HistoryCategory;
	icon: IconName;
	/** The screen-reader word for the glyph, with its colon (`phase started: `). */
	kindWord: string;
	label: string;
	mono: string | null;
	meta: string | null;
	/** The row's session start (`HH:MM`) while two sessions share the history, else null. */
	sessionTag: string | null;
	/** What a click opens in the drawer; null when the row has nothing to open. */
	item: DrawerItem | null;
	files: HistoryRowModel[];
};

/** What the history panel draws: every row oldest first, the event total, the sessions to filter by (two or more only) and the rows per category. */
export type HistoryModel = {
	rows: HistoryRowModel[];
	total: number;
	sessions: { id: string; label: string }[];
	counts: Partial<Record<HistoryCategory, number>>;
};

/** One line of the history list as drawn: a day header, or a row. */
export type HistoryListItem = { kind: "day"; key: string; text: string } | { kind: "row"; row: HistoryRowModel };

/** The history panel's type filter: every row, or one category. */
export type HistoryTypeFilter = "all" | Exclude<HistoryCategory, "sessions">;

/** One live session in the header switcher: its start, what it is doing now, and whether the view follows it. */
export type SwitcherOption = { id: string; start: string; now: string; pressed: boolean };

/** The session header's words: the way home, the project, the session's start, the root and kanban tag where known, and the switcher (empty unless two sessions are live or idle). */
export type SessionHeaderModel = {
	homeHref: string;
	project: string;
	/** `HH:MM`; null when the stream holds no start for the session. */
	sessionStart: string | null;
	rootPath: string | null;
	kanbanTag: string | null;
	switcher: SwitcherOption[];
};

/** The amber banner's words: the file and module that wait, and for how long. */
export type WaitBannerModel = { file: string; module: string; since: string };

/** One tab of the session view; `count` is the figure after its label (null for none), `tone` paints it, `phoneOnly` hides the tab on desktop. */
export type TabModel = {
	id: SessionTab;
	label: string;
	icon: IconName;
	count: string | null;
	tone: "default" | "danger";
	phoneOnly: boolean;
};

/** The plan file and step the running Build has reached, whose words the now card shows. */
export type StepSource = { file: string; step: number };

/** Everything the session view draws, derived from the stream state; `focus` is the session the card, rail and history follow. */
export type SessionModel = {
	status: Status | null;
	events: ObserverEvent[];
	sessions: SessionRowModel[];
	focus: string;
	header: SessionHeaderModel;
	/** Null when the stream holds no recording of the session (nothing is live). */
	conn: ConnState | null;
	notFound: boolean;
	reconnecting: boolean;
	/** `HH:MM:SS` of the newest held event, for the reconnecting banner; null with none. */
	lastUpdate: string | null;
	waiting: WaitBannerModel | null;
	/** The file the page opens as if clicked, when it changes (`status.surfaced`). */
	surfaced: WaitingFile | null;
	/** Set when the view is ready and its tree holds no AIDE file at all: the folder the session reported. */
	notInstalled: { projectRoot: string } | null;
	card: NowCardModel;
	phases: RailCell[];
	lanes: LaneCell[];
	tree: TreePanelModel;
	/** Null for a project that never reported its folder. */
	plans: PlanRowModel[] | null;
	board: BoardModel;
	record: RecordModel;
	history: HistoryModel;
	tabs: TabModel[];
	title: string;
};
