import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CleanupEphemeral } from "@/types/index.js";
import checkPreconditions from "./index.js";

const CHECKED = "- [x] one\n- [X] two\n";
const UNCHECKED_PLAN = "- [x] done\n- [ ] open plan item\n";
const UNCHECKED_TODO = "- [x] done\n\n- [ ] open todo item\n";
const NO_CHECKBOXES = "# Plan\n\nJust prose.\n";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "check-preconditions-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/** Writes the given ephemerals into the temp dir and returns their names in removal order. */
async function makeModule(files: Partial<Record<CleanupEphemeral, string>>): Promise<CleanupEphemeral[]> {
	const order: CleanupEphemeral[] = ["brief.aide", "todo.aide", "plan.aide"];
	const present = order.filter((name) => files[name] !== undefined);
	for (const name of present) await writeFile(join(dir, name), files[name]!);
	return present;
}

describe("checkPreconditions", () => {
	it("returns no-plan when plan.aide is absent, even with a todo present", async () => {
		const present = await makeModule({ "todo.aide": CHECKED });
		expect(await checkPreconditions(dir, present, false)).toEqual({ kind: "no-plan" });
	});

	it("returns null for a fully checked plan with no todo", async () => {
		const present = await makeModule({ "plan.aide": CHECKED });
		expect(await checkPreconditions(dir, present, false)).toBeNull();
	});

	it("returns null for a fully checked plan plus a fully checked todo", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": CHECKED });
		expect(await checkPreconditions(dir, present, false)).toBeNull();
	});

	it("returns an unchecked plan item with file, line and text", async () => {
		const present = await makeModule({ "plan.aide": UNCHECKED_PLAN });
		expect(await checkPreconditions(dir, present, false)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "plan.aide", line: 2, text: "open plan item" }],
		});
	});

	it("returns an unchecked todo item with file, line and text", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present, false)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("returns unchecked items from both files, plan first", async () => {
		const present = await makeModule({ "plan.aide": UNCHECKED_PLAN, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present, false)).toEqual({
			kind: "unchecked-items",
			items: [
				{ file: "plan.aide", line: 2, text: "open plan item" },
				{ file: "todo.aide", line: 3, text: "open todo item" },
			],
		});
	});

	it("refuses a plan with zero checkboxes by default", async () => {
		const present = await makeModule({ "plan.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present, false)).toEqual({ kind: "plan-without-checkboxes" });
	});

	it("passes a plan with zero checkboxes when allowEmptyPlan is true", async () => {
		const present = await makeModule({ "plan.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present, true)).toBeNull();
	});

	it("still refuses an empty plan plus an unchecked todo when allowEmptyPlan is true", async () => {
		const present = await makeModule({ "plan.aide": NO_CHECKBOXES, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present, true)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("still refuses a plan with an unchecked item when allowEmptyPlan is true", async () => {
		const present = await makeModule({ "plan.aide": UNCHECKED_PLAN });
		expect(await checkPreconditions(dir, present, true)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "plan.aide", line: 2, text: "open plan item" }],
		});
	});

	it("still returns no-plan when allowEmptyPlan is true", async () => {
		const present = await makeModule({ "brief.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present, true)).toEqual({ kind: "no-plan" });
	});

	it("allows a todo with zero checkboxes alongside a checked plan", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present, false)).toBeNull();
	});

	it("never lets brief.aide checkboxes block", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "brief.aide": "- [ ] not a gate\n" });
		expect(await checkPreconditions(dir, present, false)).toBeNull();
	});
});
