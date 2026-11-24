import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import parseTaskNote from "@/service/observer/kanban/shared/parseTaskNote/index.js";
import writeBoard from "./index.js";
import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";

let brainPath: string;

beforeEach(async () => {
	brainPath = await mkdtemp(join(tmpdir(), "aide-write-board-"));
});

afterEach(async () => {
	await rm(brainPath, { recursive: true, force: true });
});

function makeTask(overrides: Partial<FixtureTask> = {}): FixtureTask {
	return { column: "todo", slug: "wire-the-score", title: "Wire the score", priority: "p1", type: "feature", ...overrides };
}

describe("writeBoard", () => {
	it("writes the five column folders under kanban/<tag>, even when empty", async () => {
		await writeBoard({ brainPath, kanbanTag: "aidemd-mcp", tasks: [] });

		const columns = (await readdir(join(brainPath, "kanban", "aidemd-mcp"))).sort();
		expect(columns).toEqual(["backlog", "done", "in-progress", "in-review", "todo"]);
	});

	it("writes each task as <column>/<slug>.md with priority, type, tags and the default title heading", async () => {
		await writeBoard({ brainPath, kanbanTag: "aidemd-mcp", tasks: [makeTask()] });

		const note = await readFile(join(brainPath, "kanban", "aidemd-mcp", "todo", "wire-the-score.md"), "utf-8");
		expect(note).toBe("---\npriority: p1\ntype: feature\ntags: []\n---\n# Wire the score\n");
	});

	it("writes the task's updated stamp, which the board parser reads back as a string", async () => {
		await writeBoard({
			brainPath,
			kanbanTag: "aidemd-mcp",
			tasks: [makeTask({ column: "done", updated: "2026-11-22T18:00:00.000Z" })],
		});

		const markdown = await readFile(join(brainPath, "kanban", "aidemd-mcp", "done", "wire-the-score.md"), "utf-8");
		expect(markdown).toContain('updated: "2026-11-22T18:00:00.000Z"\n---');
		const task = parseTaskNote({ slug: "wire-the-score", column: "done", markdown, inSession: false });
		expect(task).toMatchObject({ state: "readable", updated: "2026-11-22T18:00:00.000Z" });
	});

	it("writes the task's own markdown when given, and the board parser reads the note back", async () => {
		await writeBoard({
			brainPath,
			kanbanTag: "aidemd-mcp",
			tasks: [makeTask({ column: "done", markdown: "# Wire it\n\nDone and dusted." })],
		});

		const markdown = await readFile(join(brainPath, "kanban", "aidemd-mcp", "done", "wire-the-score.md"), "utf-8");
		const task = parseTaskNote({ slug: "wire-the-score", column: "done", markdown, inSession: false });
		expect(task).toMatchObject({ state: "readable", title: "Wire it", priority: "p1", column: "done" });
	});
});
