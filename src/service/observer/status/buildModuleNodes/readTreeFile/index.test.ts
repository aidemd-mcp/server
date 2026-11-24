import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AideFile } from "@/types/index.js";
import countCheckboxes from "@/util/countCheckboxes/index.js";
import readTreeFile from "./index.js";

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeAideFile(overrides: Partial<AideFile> = {}): AideFile {
	return { path: "", relativePath: "src/a/plan.aide", type: "plan", summary: "", ...overrides };
}

/** Writes `content` to a temp file and returns an AideFile pointing at it. */
async function fileWith(content: string, overrides: Partial<AideFile> = {}): Promise<AideFile> {
	const dir = await mkdtemp(join(tmpdir(), "read-tree-file-"));
	dirs.push(dir);
	const path = join(dir, "file.aide");
	await writeFile(path, content);
	return makeAideFile({ path, ...overrides });
}

const FRONTMATTER = "---\nstatus: approved\nintent: x\n---\n";
const NINE_BOXES = ["- [x] a", "- [x] b", "- [x] c", "- [x] d", "- [x] e", "- [x] f", "- [ ] g", "- [ ] h", "- [ ] i"].join("\n");

describe("readTreeFile", () => {
	it("reports plan progress identical to countCheckboxes, fenced checkboxes included", async () => {
		const content = `${FRONTMATTER}\n${NINE_BOXES}\n\n\`\`\`\n- [ ] fenced\n\`\`\`\n`;
		const entry = await readTreeFile({ file: await fileWith(content, { workStatus: "approved" }), kind: "plan" });
		const counted = countCheckboxes(content);
		expect(entry.read).toMatchObject({ state: "present", progress: { done: counted.total - counted.open.length, total: counted.total, open: counted.open.length } });
		expect(entry.read).toMatchObject({ progress: { total: 10, open: 4, done: 6 } });
	});

	it("reports 6 of 9 checked as done 6, total 9, open 3", async () => {
		const entry = await readTreeFile({ file: await fileWith(`${FRONTMATTER}\n${NINE_BOXES}\n`, { workStatus: "approved" }), kind: "plan" });
		expect(entry.read).toMatchObject({ progress: { done: 6, total: 9, open: 3 } });
	});

	it("flags a proposed plan as awaiting approval and an approved one as not", async () => {
		const proposed = await readTreeFile({ file: await fileWith(FRONTMATTER, { workStatus: "proposed" }), kind: "plan" });
		const approved = await readTreeFile({ file: await fileWith(FRONTMATTER, { workStatus: "approved" }), kind: "plan" });
		expect(proposed.read).toMatchObject({ status: "proposed", awaitingApproval: true });
		expect(approved.read).toMatchObject({ status: "approved", awaitingApproval: false });
	});

	it("reads a plan with no workStatus as unset", async () => {
		const entry = await readTreeFile({ file: await fileWith(FRONTMATTER), kind: "plan" });
		expect(entry.read).toMatchObject({ status: "unset", awaitingApproval: false });
	});

	it("counts numbered plan steps for a plan and checkboxes for a todo", async () => {
		const plan = "---\nstatus: approved\n---\n## Plan\n### 1. A\n- [x] a\n### 2. B\n- [ ] b\n";
		const planEntry = await readTreeFile({ file: await fileWith(plan, { workStatus: "approved" }), kind: "plan" });
		const todoEntry = await readTreeFile({ file: await fileWith("---\nstatus: approved\n---\n- [x] a\n- [ ] b\n- [ ] c\n", { workStatus: "approved", relativePath: "src/a/todo.aide" }), kind: "todo" });
		expect(planEntry.read).toMatchObject({ steps: { done: 1, total: 2 } });
		expect(todoEntry.read).toMatchObject({ steps: { done: 1, total: 3 } });
	});

	it("reads a brief's status from its frontmatter", async () => {
		const brief = (status: string) => fileWith(`---\nstatus: ${status}\n---\nbody\n`, { relativePath: "src/a/brief.aide", type: "intent" });
		const proposed = await readTreeFile({ file: await brief("proposed"), kind: "brief" });
		const bogus = await readTreeFile({ file: await brief("bogus"), kind: "brief" });
		const none = await readTreeFile({ file: await fileWith("---\nintent: x\n---\nbody\n", { relativePath: "src/a/brief.aide" }), kind: "brief" });
		expect(proposed.read).toMatchObject({ status: "proposed", awaitingApproval: true });
		expect(bogus.read).toMatchObject({ status: "unset", awaitingApproval: false });
		expect(none.read).toMatchObject({ status: "unset" });
	});

	it("reads an intent spec's alignment and description from scan", async () => {
		const file = await fileWith("---\nintent: x\n---\n", { relativePath: "src/a/.aide", type: "intent", alignment: "misaligned", description: "does a" });
		const entry = await readTreeFile({ file, kind: "intent" });
		expect(entry).toMatchObject({ kind: "intent", file: "src/a/.aide", folder: "src/a", read: { state: "present", alignment: "misaligned", description: "does a" } });
	});

	it("marks an intent spec with no frontmatter block malformed", async () => {
		const entry = await readTreeFile({ file: await fileWith("just prose\n", { relativePath: "src/a/.aide" }), kind: "intent" });
		expect(entry.read).toEqual({ state: "malformed", error: "no frontmatter" });
	});

	it("marks a file scan flagged with parseError malformed", async () => {
		const entry = await readTreeFile({ file: makeAideFile({ parseError: "bad yaml" }), kind: "plan" });
		expect(entry.read).toEqual({ state: "malformed", error: "bad yaml" });
	});

	it("marks an unreadable path malformed with the error code", async () => {
		const entry = await readTreeFile({ file: makeAideFile({ path: join(tmpdir(), "does-not-exist-xyz", "plan.aide") }), kind: "plan" });
		expect(entry.read).toEqual({ state: "malformed", error: "ENOENT" });
	});

	it("reads a session record with checkboxes as present with progress", async () => {
		const file = await fileWith("## Notes\n- [x] a\n- [ ] b\n", { relativePath: ".aide/session.aide" });
		const entry = await readTreeFile({ file, kind: "session" });
		expect(entry).toMatchObject({ kind: "session", folder: ".", read: { state: "present", progress: { done: 1, total: 2, open: 1 } } });
	});

	it("reads brain.aide as an other file without requiring frontmatter", async () => {
		const file = await fileWith("plain text\n", { relativePath: ".aide/config/brain.aide" });
		const entry = await readTreeFile({ file, kind: "other" });
		expect(entry).toMatchObject({ kind: "other", folder: ".aide/config", read: { state: "present" } });
	});
});
