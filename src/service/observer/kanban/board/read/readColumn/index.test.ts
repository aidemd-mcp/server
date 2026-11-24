import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readColumn from "@/service/observer/kanban/board/read/readColumn/index.js";

let board: string;
let outside: string;

beforeEach(async () => {
	const root = await mkdtemp(join(tmpdir(), "kanban-column-"));
	board = join(root, "board");
	outside = join(root, "outside");
	await mkdir(join(board, "todo"), { recursive: true });
	await mkdir(outside, { recursive: true });
});

afterEach(async () => {
	await rm(join(board, ".."), { recursive: true, force: true });
});

/** Writes one task note into the board's todo column. */
async function writeNote({
	slug,
	priority,
	updated,
	body = "",
}: {
	slug: string;
	priority?: string;
	updated?: string;
	body?: string;
}): Promise<void> {
	const lines = ["---", "project: demo", ...(priority ? [`priority: ${priority}`] : []), ...(updated ? [`updated: "${updated}"`] : []), "---", body || `# ${slug}`];
	await writeFile(join(board, "todo", `${slug}.md`), lines.join("\n"));
}

describe("readColumn", () => {
	it("returns an empty column when the column folder does not exist", async () => {
		const tasks = await readColumn({ boardFolder: board, column: "in-review", sessionKanban: "" });

		expect(tasks).toEqual([]);
	});

	it("reads only .md files, ignoring sub-folders and other files", async () => {
		await writeNote({ slug: "real" });
		await writeFile(join(board, "todo", "notes.txt"), "x");
		await mkdir(join(board, "todo", "folder.md"));

		const tasks = await readColumn({ boardFolder: board, column: "todo", sessionKanban: "" });

		expect(tasks.map((task) => task.slug)).toEqual(["real"]);
	});

	it("sorts by priority, then updated descending with missing last, then slug", async () => {
		await writeNote({ slug: "z-p1-old", priority: "p1", updated: "2026-01-01T00:00:00" });
		await writeNote({ slug: "a-p1-new", priority: "p1", updated: "2026-02-01T00:00:00" });
		await writeNote({ slug: "m-p1-none", priority: "p1" });
		await writeNote({ slug: "b-p1-none", priority: "p1" });
		await writeNote({ slug: "p0-task", priority: "p0" });
		await writeNote({ slug: "p3-task", priority: "p3" });
		await writeFile(join(board, "todo", "broken.md"), "---\npriority: [p1\n---\n# broken");

		const tasks = await readColumn({ boardFolder: board, column: "todo", sessionKanban: "" });

		expect(tasks.map((task) => task.slug)).toEqual([
			"p0-task",
			"a-p1-new",
			"z-p1-old",
			"b-p1-none",
			"m-p1-none",
			"p3-task",
			"broken",
		]);
	});

	it("marks a task the session names and leaves the rest unmarked", async () => {
		await writeNote({ slug: "fix-login-bug" });
		await writeNote({ slug: "fix-login" });

		const tasks = await readColumn({ boardFolder: board, column: "todo", sessionKanban: "`fix-login-bug` (Todo)" });

		expect(Object.fromEntries(tasks.map((task) => [task.slug, task.inSession]))).toEqual({
			"fix-login-bug": true,
			"fix-login": false,
		});
	});

	it("keeps a malformed note as unreadable with its column", async () => {
		await writeFile(join(board, "todo", "broken.md"), "---\npriority: [p1\n---\n# broken");

		const [task] = await readColumn({ boardFolder: board, column: "todo", sessionKanban: "" });

		expect(task).toMatchObject({ state: "unreadable", slug: "broken", column: "todo" });
	});

	it("marks a note that resolves outside the board as unreadable without reading it", async () => {
		await writeFile(join(outside, "secret.md"), "---\npriority: p0\n---\n# secret");
		try {
			await symlink(join(outside, "secret.md"), join(board, "todo", "secret.md"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EPERM") return;
			throw error;
		}

		const [task] = await readColumn({ boardFolder: board, column: "todo", sessionKanban: "" });

		expect(task).toMatchObject({ state: "unreadable", slug: "secret", reason: "note resolves outside the board" });
	});
});
