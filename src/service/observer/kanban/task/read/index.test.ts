import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readTask from "./index.js";
import boardHints from "@/service/observer/kanban/shared/boardHints/index.js";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, readFile: vi.fn(actual.readFile) };
});

const TAG = "my-project";

let brain: string;
let project: string;

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

/** Writes a task note into the temp brain's board and returns its path. */
async function writeTask({
	column,
	slug,
	content,
	tag = TAG,
}: {
	column: string;
	slug: string;
	content?: string;
	tag?: string;
}): Promise<string> {
	const folder = join(brain, "kanban", tag, column);
	await mkdir(folder, { recursive: true });
	const path = join(folder, `${slug}.md`);
	await writeFile(path, content ?? `---\nproject: ${tag}\npriority: p1\ntype: feature\n---\n\n# Title of ${slug}\n\nBody.\n`);
	return path;
}

/** The location a session would report: its kanban tag only. */
function reportedFor(kanbanTag: string = TAG) {
	return { kanbanTag };
}

/** Every path under a folder with its size and mtime, for before/after comparison. */
async function snapshot(folder: string): Promise<string[]> {
	const entries = await readdir(folder, { recursive: true });
	const lines = await Promise.all(
		entries.map(async (entry) => {
			const info = await stat(join(folder, entry));
			return `${entry}|${info.size}|${info.mtimeMs}`;
		}),
	);
	return lines.sort();
}

beforeEach(async () => {
	brain = await mkdtemp(join(tmpdir(), "task-brain-"));
	project = await mkdtemp(join(tmpdir(), "task-project-"));
	await mkdir(join(brain, "kanban", TAG), { recursive: true });
	await writeBrainConfig();
	vi.mocked(readFile).mockClear();
});

afterEach(async () => {
	await rm(brain, { recursive: true, force: true });
	await rm(project, { recursive: true, force: true });
});

describe("task/read", () => {
	it("returns the full note byte-for-byte with the parsed task", async () => {
		const path = await writeTask({ column: "in-progress", slug: "fix-it" });
		const expected = await readFile(path, "utf-8");
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "fix-it" });
		expect(result).toMatchObject({ state: "found", slug: "fix-it", column: "in-progress", markdown: expected });
		if (result.state !== "found") throw new Error("expected found");
		expect(result.task).toMatchObject({ state: "readable", title: "Title of fix-it", priority: "p1", type: "feature" });
	});

	it("marks a task the session record names", async () => {
		await writeTask({ column: "todo", slug: "fix-it" });
		await mkdir(join(project, ".aide"), { recursive: true });
		await writeFile(join(project, ".aide", "session.aide"), "# session\n\n## Kanban\n\n- `fix-it` (Todo)\n");
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "fix-it" });
		if (result.state !== "found") throw new Error("expected found");
		expect(result.task.inSession).toBe(true);
	});

	it("returns an unparseable note as found with an unreadable task and the full markdown", async () => {
		const content = "---\npriority: [p1\n---\n# Broken\n";
		await writeTask({ column: "todo", slug: "broken", content });
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "broken" });
		if (result.state !== "found") throw new Error("expected found");
		expect(result.task.state).toBe("unreadable");
		expect(result.markdown).toBe(content);
	});

	it("returns not-found for an unknown slug", async () => {
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "nope" });
		expect(result).toEqual({ state: "not-found", slug: "nope" });
	});

	it.each(["../../secret", "..\\..\\secret", "../other-tag/todo/x", "a/b", ".hidden", ""])(
		"refuses the slug %j and reads nothing outside the board",
		async (slug) => {
			await writeFile(join(brain, "secret.md"), "secret");
			const result = await readTask({ reported: reportedFor(), projectRoot: project, slug });
			expect(result.state).toBe("refused");
			const boardFolder = join(brain, "kanban", TAG);
			// The project's brain config is the one file read outside the board: it says where the board is.
			const configPath = join(project, ".aide", "config", "brain.aide");
			for (const [path] of vi.mocked(readFile).mock.calls) {
				if (String(path) === configPath) continue;
				expect(String(path).startsWith(boardFolder)).toBe(true);
			}
		},
	);

	it("refuses a symlinked note that points outside the board", async (context) => {
		const outside = join(brain, "secret.md");
		await writeFile(outside, "secret");
		await mkdir(join(brain, "kanban", TAG, "todo"), { recursive: true });
		try {
			await symlink(outside, join(brain, "kanban", TAG, "todo", "linked.md"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EPERM") return context.skip();
			throw error;
		}
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "linked" });
		expect(result.state).toBe("refused");
		expect(vi.mocked(readFile)).not.toHaveBeenCalledWith(outside, expect.anything());
	});

	it("does not find a task that exists only in archive/", async () => {
		await writeTask({ column: "archive", slug: "old-task" });
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "old-task" });
		expect(result).toEqual({ state: "not-found", slug: "old-task" });
	});

	it("does not find another project's task with the same slug", async () => {
		await writeTask({ column: "todo", slug: "shared-slug", tag: "other-tag" });
		const result = await readTask({ reported: reportedFor(), projectRoot: project, slug: "shared-slug" });
		expect(result).toEqual({ state: "not-found", slug: "shared-slug" });
	});

	it("answers unavailable when the project has no brain config", async () => {
		const bare = await mkdtemp(join(tmpdir(), "task-bare-"));
		try {
			const result = await readTask({ reported: null, projectRoot: bare, slug: "fix-it" });
			expect(result).toMatchObject({
				state: "unavailable",
				reason: "no-brain-config",
				hint: boardHints["no-brain-config"],
			});
		} finally {
			await rm(bare, { recursive: true, force: true });
		}
	});

	it("reads the task through the kanban folder override with no brain config", async () => {
		await writeTask({ column: "todo", slug: "fix-it" });
		await rm(join(project, ".aide", "config"), { recursive: true, force: true });
		const result = await readTask({
			reported: reportedFor(),
			kanbanOverride: join(brain, "kanban"),
			projectRoot: project,
			slug: "fix-it",
		});
		expect(result).toMatchObject({ state: "found", slug: "fix-it", column: "todo" });
	});

	it("never writes: the brain and project are identical before and after", async () => {
		await writeTask({ column: "todo", slug: "fix-it" });
		const before = [await snapshot(brain), await snapshot(project)];
		await readTask({ reported: reportedFor(), projectRoot: project, slug: "fix-it" });
		expect([await snapshot(brain), await snapshot(project)]).toEqual(before);
	});
});
