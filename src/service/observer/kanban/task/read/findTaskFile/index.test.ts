import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import findTaskFile from "./index.js";

let root: string;
let boardFolder: string;

/** Writes a note into a column folder of the temp board. */
async function writeNote({ column, slug }: { column: string; slug: string }): Promise<string> {
	await mkdir(join(boardFolder, column), { recursive: true });
	const path = join(boardFolder, column, `${slug}.md`);
	await writeFile(path, "---\npriority: p2\n---\n# T\n");
	return path;
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "find-task-"));
	boardFolder = join(root, "kanban", "tag");
	await mkdir(boardFolder, { recursive: true });
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("findTaskFile", () => {
	it("finds a note in its column", async () => {
		const path = await writeNote({ column: "in-progress", slug: "fix-it" });
		expect(await findTaskFile({ boardFolder, slug: "fix-it" })).toEqual({ state: "found", column: "in-progress", path });
	});

	it("returns not-found for an unknown slug", async () => {
		await writeNote({ column: "todo", slug: "other" });
		expect(await findTaskFile({ boardFolder, slug: "fix-it" })).toEqual({ state: "not-found" });
	});

	it("does not search archive/", async () => {
		await writeNote({ column: "archive", slug: "old-task" });
		expect(await findTaskFile({ boardFolder, slug: "old-task" })).toEqual({ state: "not-found" });
	});

	it.each(["../../secret", "..\\..\\secret", "../other-tag/todo/x", "a/b", ".hidden", "", "a..b"])(
		"refuses the slug %j",
		async (slug) => {
			expect((await findTaskFile({ boardFolder, slug })).state).toBe("refused");
		},
	);

	it("refuses a symlinked note that resolves outside the board", async (context) => {
		const outside = join(root, "secret.md");
		await writeFile(outside, "secret");
		await mkdir(join(boardFolder, "todo"), { recursive: true });
		try {
			await symlink(outside, join(boardFolder, "todo", "linked.md"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EPERM") return context.skip();
			throw error;
		}
		expect(await findTaskFile({ boardFolder, slug: "linked" })).toEqual({
			state: "refused",
			detail: "note resolves outside the board",
		});
	});
});
