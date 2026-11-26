import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import read from "@/service/observer/kanban/board/read/index.js";
import type { BoardColumnId } from "@/service/observer/kanban/types/index.js";

const TAG = "demo";

let root: string;
let brain: string;
let project: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "kanban-board-"));
	brain = join(root, "brain");
	project = join(root, "project");
	await mkdir(join(brain, "kanban", TAG), { recursive: true });
	await mkdir(join(project, ".aide"), { recursive: true });
	await writeBrainConfig();
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

/** Writes the project's brain config with its kanban field pointing at the temp brain's kanban folder. */
async function writeBrainConfig(): Promise<void> {
	await mkdir(join(project, ".aide", "config"), { recursive: true });
	await writeFile(
		join(project, ".aide", "config", "brain.aide"),
		`---
name: test
mcpServerConfig:
  command: mcpvault
  args:
    - "x"
kanban:
  source: folder
  path: ${JSON.stringify(join(brain, "kanban"))}
---
`,
	);
}

/** Writes one task note into a column of a project's board in the temp brain. */
async function writeTask({
	tag = TAG,
	column,
	slug,
	frontmatter = "priority: p2",
	body,
}: {
	tag?: string;
	column: BoardColumnId | "archive";
	slug: string;
	frontmatter?: string;
	body?: string;
}): Promise<void> {
	await mkdir(join(brain, "kanban", tag, column), { recursive: true });
	await writeFile(
		join(brain, "kanban", tag, column, `${slug}.md`),
		`---\nproject: ${tag}\n${frontmatter}\n---\n${body ?? `# Title of ${slug}`}\n`,
	);
}

/** Writes the project's session record with the given Kanban section and an optional extra section. */
async function writeSession({ kanban, summary = "" }: { kanban: string; summary?: string }): Promise<void> {
	await writeFile(
		join(project, ".aide", "session.aide"),
		`---\nstatus: active\n---\n\n## State summary\n\n${summary}\n\n## Kanban\n\n${kanban}\n`,
	);
}

/** Every path under a folder with its size and mtime, to prove a read changed nothing. */
async function snapshot(folder: string): Promise<string[]> {
	const entries = await readdir(folder, { recursive: true });
	const lines = await Promise.all(
		entries.sort().map(async (entry) => {
			const info = await stat(join(folder, entry));
			return `${entry}|${info.size}|${info.mtimeMs}`;
		}),
	);
	return lines;
}

/** Reads the board with the demo tag reported; the board's folder comes from the project's brain config. */
function readBoard() {
	return read({ reported: { kanbanTag: TAG }, projectRoot: project });
}

describe("board read", () => {
	it("returns the five columns in order with labels and each task's fields", async () => {
		await writeTask({ column: "todo", slug: "add-thing", frontmatter: "priority: p1\ntype: feature\ntags: [a, b]" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.kanbanTag).toBe(TAG);
		expect(board.columns.map((column) => [column.id, column.label])).toEqual([
			["backlog", "Backlog"],
			["todo", "Todo"],
			["in-progress", "In Progress"],
			["in-review", "In Review"],
			["done", "Done"],
		]);
		expect(board.columns[1].tasks).toEqual([
			{
				state: "readable",
				slug: "add-thing",
				column: "todo",
				title: "Title of add-thing",
				priority: "p1",
				type: "feature",
				tags: ["a", "b"],
				inSession: false,
			},
		]);
	});

	it("keeps a column empty when its folder is missing and the board stays available", async () => {
		await writeTask({ column: "todo", slug: "only-task" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.columns.find((column) => column.id === "in-review")?.tasks).toEqual([]);
		expect(board.columns.find((column) => column.id === "todo")?.tasks).toHaveLength(1);
	});

	it("never shows archive tasks", async () => {
		await writeTask({ column: "archive", slug: "old-task" });
		await writeTask({ column: "done", slug: "finished" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		const slugs = board.columns.flatMap((column) => column.tasks.map((task) => task.slug));
		expect(slugs).toEqual(["finished"]);
	});

	it("marks a task the session's Kanban section names, not one named in another section", async () => {
		await writeTask({ column: "in-progress", slug: "named-task" });
		await writeTask({ column: "todo", slug: "mentioned-only" });
		await writeSession({ kanban: "`named-task` (In Progress)", summary: "also touched mentioned-only here" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		const marks = Object.fromEntries(board.columns.flatMap((column) => column.tasks.map((task) => [task.slug, task.inSession])));
		expect(marks).toEqual({ "named-task": true, "mentioned-only": false });
	});

	it("marks every task unmarked when there is no session record", async () => {
		await writeTask({ column: "todo", slug: "some-task" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.columns.flatMap((column) => column.tasks).every((task) => !task.inSession)).toBe(true);
	});

	it("shows one malformed note as unreadable while every other task stays readable", async () => {
		await writeTask({ column: "todo", slug: "good-one" });
		await writeTask({ column: "todo", slug: "bad-one", frontmatter: "priority: [p1" });
		await writeTask({ column: "done", slug: "good-two" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		const todo = board.columns.find((column) => column.id === "todo")!;
		expect(todo.tasks.find((task) => task.slug === "bad-one")?.state).toBe("unreadable");
		expect(todo.tasks.find((task) => task.slug === "good-one")?.state).toBe("readable");
		expect(board.columns.find((column) => column.id === "done")?.tasks[0].state).toBe("readable");
	});

	it("never drops a note: the task count equals the .md file count", async () => {
		await writeTask({ column: "todo", slug: "one" });
		await writeTask({ column: "todo", slug: "two", frontmatter: "priority: [p1" });
		await writeTask({ column: "backlog", slug: "three" });
		await writeFile(join(brain, "kanban", TAG, "backlog", "four.md"), "no frontmatter at all");

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.columns.flatMap((column) => column.tasks)).toHaveLength(4);
	});

	it("sorts by priority, then updated descending, then slug", async () => {
		await writeTask({ column: "todo", slug: "b-p2", frontmatter: "priority: p2" });
		await writeTask({ column: "todo", slug: "a-p2", frontmatter: "priority: p2" });
		await writeTask({ column: "todo", slug: "old-p1", frontmatter: 'priority: p1\nupdated: "2026-01-01T00:00:00"' });
		await writeTask({ column: "todo", slug: "new-p1", frontmatter: 'priority: p1\nupdated: "2026-03-01T00:00:00"' });
		await writeTask({ column: "todo", slug: "top-p0", frontmatter: "priority: p0" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.columns[1].tasks.map((task) => task.slug)).toEqual(["top-p0", "new-p1", "old-p1", "a-p2", "b-p2"]);
	});

	it("answers no-brain-config for a project with no brain config, even when nothing was reported", async () => {
		await writeTask({ column: "todo", slug: "some-task" });
		const bare = await mkdtemp(join(tmpdir(), "kanban-board-bare-"));

		try {
			const result = await read({ reported: null, projectRoot: bare });

			expect(result).toMatchObject({ state: "unavailable", reason: "no-brain-config" });
		} finally {
			await rm(bare, { recursive: true, force: true });
		}
	});

	it("reads the board from the brain config when the session reported no brain folder at all", async () => {
		await writeTask({ column: "todo", slug: "some-task" });

		const result = await read({ reported: { kanbanTag: TAG }, projectRoot: project });

		if (result.state !== "available") throw new Error("expected an available board");
		expect(result.boardFolder).toBe(join(brain, "kanban", TAG));
		expect(result.columns[1].tasks.map((task) => task.slug)).toEqual(["some-task"]);
	});

	it("uses the override kanban folder but still the reported tag", async () => {
		await writeTask({ column: "todo", slug: "some-task" });
		await rm(join(project, ".aide", "config"), { recursive: true, force: true });

		const result = await read({
			reported: { kanbanTag: TAG },
			kanbanOverride: join(brain, "kanban"),
			projectRoot: project,
		});

		if (result.state !== "available") throw new Error("expected an available board");
		expect(result.boardFolder).toBe(join(brain, "kanban", TAG));
	});

	it("never shows another project's board from the same brain", async () => {
		await writeTask({ column: "todo", slug: "mine" });
		await writeTask({ tag: "other-tag", column: "todo", slug: "theirs" });

		const board = await readBoard();

		if (board.state !== "available") throw new Error("expected an available board");
		expect(board.columns.flatMap((column) => column.tasks.map((task) => task.slug))).toEqual(["mine"]);
	});

	it("is read-only: the brain and the project are identical before and after", async () => {
		await writeTask({ column: "todo", slug: "some-task" });
		await writeTask({ column: "done", slug: "bad", frontmatter: "priority: [p1" });
		await writeSession({ kanban: "`some-task` (Todo)" });
		const brainBefore = await snapshot(brain);
		const projectBefore = await snapshot(project);

		await readBoard();

		expect(await snapshot(brain)).toEqual(brainBefore);
		expect(await snapshot(project)).toEqual(projectBefore);
	});
});
