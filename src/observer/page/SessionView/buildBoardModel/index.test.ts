import { describe, expect, it } from "vitest";
import type { BoardColumn, BoardColumnId, BoardTask, ObserverEvent, Status } from "@/types/index.js";
import type { ProjectView } from "@/observer/types/index.js";
import buildBoardModel from "./index.js";

const GENERATED_AT = new Date(2026, 10, 23, 14, 31, 2).toISOString();

function task({ slug, column, updated, inSession = false }: { slug: string; column: BoardColumnId; updated?: string; inSession?: boolean }): BoardTask {
	return {
		state: "readable",
		slug,
		column,
		title: `Title of ${slug}`,
		priority: "p2",
		tags: [],
		inSession,
		...(updated === undefined ? {} : { updated }),
	};
}

function column({ id, label, tasks }: { id: BoardColumnId; label: BoardColumn["label"]; tasks: BoardTask[] }): BoardColumn {
	return { id, label, tasks };
}

function boardView({ columns }: { columns: BoardColumn[] }): ProjectView {
	const board = { state: "available" as const, kanbanTag: "proj", boardFolder: "/brain/kanban/proj", columns };
	return { state: "ready", projectKey: "app-1", status: { generatedAt: GENERATED_AT, board } as Status };
}

function fiveColumns({ done = [], backlog = [] }: { done?: BoardTask[]; backlog?: BoardTask[] }): BoardColumn[] {
	return [
		column({ id: "backlog", label: "Backlog", tasks: backlog }),
		column({ id: "todo", label: "Todo", tasks: [] }),
		column({ id: "in-progress", label: "In Progress", tasks: [] }),
		column({ id: "in-review", label: "In Review", tasks: [] }),
		column({ id: "done", label: "Done", tasks: done }),
	];
}

function taskEvent({ slug, sessionId }: { slug: string; sessionId: string }): ObserverEvent {
	return { v: 1, ts: "2026-11-23T10:00:00.000Z", sessionId, pid: 1, seq: 1, kind: "task", slug, action: "picked" } as ObserverEvent;
}

function unavailableView({ reason, detail, hint }: { reason: Extract<Status["board"], { state: "unavailable" }>["reason"]; detail: string; hint: string }): ProjectView {
	return { state: "ready", projectKey: "app-1", status: { generatedAt: GENERATED_AT, board: { state: "unavailable", reason, detail, hint } } as Status };
}

describe("buildBoardModel", () => {
	it("orders a 128-task Done column by updated descending, caps it at 5 and keeps the whole column in the model", () => {
		const done = Array.from({ length: 128 }, (_, index) =>
			task({ slug: `done-${String(index).padStart(3, "0")}`, column: "done", updated: new Date(Date.UTC(2026, 0, 1 + index)).toISOString() }),
		);
		const model = buildBoardModel({ view: boardView({ columns: fiveColumns({ done }) }), events: [], focus: "s1" });
		if (model.kind !== "board") throw new Error("expected a board");

		const doneColumn = model.columns[4]!;
		expect(doneColumn).toMatchObject({ id: "done", name: "Done", total: 128, cap: 5 });
		expect(doneColumn.tasks).toHaveLength(128);
		expect(doneColumn.tasks.slice(0, 5).map((card) => card.slug)).toEqual(["done-127", "done-126", "done-125", "done-124", "done-123"]);
		expect(model.countLine).toBe("128 tasks · 0 linked to this session");
	});

	it("puts Done tasks with no updated value last, by slug", () => {
		const done = [task({ slug: "b-undated", column: "done" }), task({ slug: "dated", column: "done", updated: "2026-11-01" }), task({ slug: "a-undated", column: "done" })];
		const model = buildBoardModel({ view: boardView({ columns: fiveColumns({ done }) }), events: [], focus: "s1" });
		if (model.kind !== "board") throw new Error("expected a board");
		expect(model.columns[4]!.tasks.map((card) => card.slug)).toEqual(["dated", "a-undated", "b-undated"]);
	});

	it("keeps the observer's order and a cap of 8 on every other column", () => {
		const backlog = ["c", "a", "b"].map((slug) => task({ slug, column: "backlog" }));
		const model = buildBoardModel({ view: boardView({ columns: fiveColumns({ backlog }) }), events: [], focus: "s1" });
		if (model.kind !== "board") throw new Error("expected a board");
		expect(model.columns.map((entry) => [entry.id, entry.name, entry.total, entry.cap])).toEqual([
			["backlog", "Backlog", 3, 8],
			["todo", "Todo", 0, 8],
			["in-progress", "In Progress", 0, 8],
			["in-review", "In Review", 0, 8],
			["done", "Done", 0, 5],
		]);
		expect(model.columns[0]!.tasks.map((card) => card.slug)).toEqual(["c", "a", "b"]);
	});

	it("links a task the focused session picked or the record names, and counts them across the whole board", () => {
		const backlog = [task({ slug: "picked", column: "backlog" }), task({ slug: "named", column: "backlog", inSession: true }), task({ slug: "other-session", column: "backlog" }), task({ slug: "plain", column: "backlog" })];
		const events = [taskEvent({ slug: "picked", sessionId: "s1" }), taskEvent({ slug: "other-session", sessionId: "s2" })];
		const model = buildBoardModel({ view: boardView({ columns: fiveColumns({ backlog }) }), events, focus: "s1" });
		if (model.kind !== "board") throw new Error("expected a board");
		expect(model.columns[0]!.tasks.map((card) => [card.slug, card.linked])).toEqual([
			["picked", true],
			["named", true],
			["other-session", false],
			["plain", false],
		]);
		expect(model.countLine).toBe("4 tasks · 2 linked to this session");
	});

	it("carries an unreadable note's reason and no priority or type", () => {
		const backlog: BoardTask[] = [{ state: "unreadable", slug: "broken", column: "backlog", reason: "frontmatter is not YAML", inSession: false }];
		const model = buildBoardModel({ view: boardView({ columns: fiveColumns({ backlog }) }), events: [], focus: "s1" });
		if (model.kind !== "board") throw new Error("expected a board");
		expect(model.columns[0]!.tasks[0]).toEqual({ slug: "broken", title: "broken", priority: null, type: null, linked: false, unreadable: "frontmatter is not YAML" });
	});

	it.each([
		["brain-path-missing", "/brain is not a folder that exists"],
		["board-read-failed", "board read failed: EACCES"],
	] as const)("calls %s the board's error notice, with the detail and the time of the last read", (reason, detail) => {
		const model = buildBoardModel({ view: unavailableView({ reason, detail, hint: "a hint" }), events: [], focus: "s1" });
		expect(model).toEqual({
			kind: "unavailable",
			tone: "err",
			heading: "Board can't load right now",
			text: `The brain folder isn't reachable (${detail}). Everything else on this page is live.`,
			meta: "Read again on every new event and page load · last try 14:31:02",
		});
	});

	it.each([
		["no-brain-path", "no session has reported a brain folder", "No session has reported a brain folder."],
		["no-kanban-tag", "no session has reported a kanban tag", "No session has reported a kanban tag."],
		["board-folder-missing", "/brain/kanban/proj is not a folder that exists", "/brain/kanban/proj is not a folder that exists."],
	] as const)("calls %s calm, saying the observer's detail and hint", (reason, detail, sentence) => {
		const model = buildBoardModel({ view: unavailableView({ reason, detail, hint: "Report the folder." }), events: [], focus: "s1" });
		expect(model).toEqual({ kind: "unavailable", tone: "calm", heading: "Board unavailable", text: `${sentence} Report the folder.`, meta: null });
	});

	it("says the handoff's sentence for a project with no reported root", () => {
		const model = buildBoardModel({ view: { state: "no-project-root", projectKey: "app-1", detail: "nobody reported a root" }, events: [], focus: "s1" });
		expect(model).toEqual({
			kind: "unavailable",
			tone: "calm",
			heading: "Board unavailable",
			text: "This project hasn't reported its folder or brain folder, so its kanban board can't be found. Tasks the agent picked still show in History.",
			meta: null,
		});
	});

	it("is calm before the first view arrives", () => {
		expect(buildBoardModel({ view: null, events: [], focus: "s1" })).toMatchObject({ kind: "unavailable", tone: "calm", heading: "Board unavailable" });
	});
});
