import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readSessionKanban from "./index.js";

let project: string;

/** Writes `.aide/session.aide` with the given body under a minimal frontmatter block. */
async function writeSession({ body }: { body: string }): Promise<void> {
	await mkdir(join(project, ".aide"), { recursive: true });
	await writeFile(join(project, ".aide", "session.aide"), `---\nintent: x\n---\n\n${body}\n`);
}

beforeEach(async () => {
	project = await mkdtemp(join(tmpdir(), "session-kanban-"));
});

afterEach(async () => {
	await rm(project, { recursive: true, force: true });
});

describe("readSessionKanban", () => {
	it("returns an empty string when there is no session record", async () => {
		expect(await readSessionKanban({ projectRoot: project })).toBe("");
	});

	it("returns an empty string for a placeholder with an empty Kanban section", async () => {
		await writeSession({ body: "## State summary\n\nNothing yet.\n\n## Kanban\n" });
		expect(await readSessionKanban({ projectRoot: project })).toBe("");
	});

	it("returns the Kanban section text", async () => {
		await writeSession({ body: "## Kanban\n\n- `slug-a` (In Progress)\n" });
		expect(await readSessionKanban({ projectRoot: project })).toContain("slug-a");
	});

	it("does not return text under other headings", async () => {
		await writeSession({ body: "## State summary\n\nWorking on `slug-b`.\n\n## Kanban\n\n- `slug-a` (Todo)\n" });
		const text = await readSessionKanban({ projectRoot: project });
		expect(text).toContain("slug-a");
		expect(text).not.toContain("slug-b");
	});
});
