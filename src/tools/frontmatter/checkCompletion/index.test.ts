import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import checkCompletion from "./index.js";

let dir: string;

beforeEach(async () => {
	dir = await realpath(await mkdtemp(join(tmpdir(), "check-completion-")));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const withStatus = (status: string | null, body = "") =>
	`---\n${status === null ? "intent: x" : `status: ${status}`}\n---\n${body}`;

describe("checkCompletion", () => {
	it("refuses a plan with an open item, naming line and text", async () => {
		const content = withStatus("approved", "- [x] one\n- [ ] two\n");
		expect(await checkCompletion({ absPath: join(dir, "plan.aide"), content, kind: "plan" })).toEqual({
			kind: "open-items",
			items: [{ line: 5, text: "two" }],
		});
	});

	it.each([
		["a fully checked plan", "plan", "- [x] one\n- [X] two\n"],
		["a plan with zero checkboxes", "plan", "just prose\n"],
		["a fully checked todo", "todo", "- [x] fix\n"],
		["a todo with zero checkboxes", "todo", "nothing\n"],
	] as const)("allows %s", async (_name, kind, body) => {
		const content = withStatus("approved", body);
		expect(await checkCompletion({ absPath: join(dir, `${kind}.aide`), content, kind })).toBeNull();
	});

	it("refuses an open todo item", async () => {
		const content = withStatus("approved", "- [ ] fix\n");
		expect(await checkCompletion({ absPath: join(dir, "todo.aide"), content, kind: "todo" })).toEqual({
			kind: "open-items",
			items: [{ line: 4, text: "fix" }],
		});
	});

	it("refuses a brief with no plan beside it as missing", async () => {
		expect(
			await checkCompletion({ absPath: join(dir, "brief.aide"), content: withStatus("approved"), kind: "brief" }),
		).toEqual({ kind: "plan-not-completed", plan: "missing" });
	});

	it.each([
		["an approved plan", withStatus("approved"), "approved"],
		["a plan with no status", withStatus(null), "not set"],
		["a plan with a retired value", withStatus("in-flight"), '"in-flight"'],
	])("refuses a brief beside %s", async (_name, planContent, expected) => {
		await writeFile(join(dir, "plan.aide"), planContent);
		expect(
			await checkCompletion({ absPath: join(dir, "brief.aide"), content: withStatus("approved"), kind: "brief" }),
		).toEqual({ kind: "plan-not-completed", plan: expected });
	});

	it("allows a brief beside a completed plan", async () => {
		await writeFile(join(dir, "plan.aide"), withStatus("completed"));
		expect(
			await checkCompletion({ absPath: join(dir, "brief.aide"), content: withStatus("approved"), kind: "brief" }),
		).toBeNull();
	});
});
