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

/** Prefixes a body with a frontmatter block recording the given status value. */
function withStatus(status: string, body: string): string {
	return `---\nstatus: ${status}\n---\n${body}`;
}

describe("checkPreconditions", () => {
	it("returns no-ephemerals for an empty present list", async () => {
		expect(await checkPreconditions(dir, [])).toEqual({ kind: "no-ephemerals" });
	});

	it("returns null for a fully checked todo with no plan", async () => {
		const present = await makeModule({ "todo.aide": CHECKED });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("returns the unchecked item of a todo with no plan", async () => {
		const present = await makeModule({ "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("refuses a todo with zero checkboxes and no plan", async () => {
		const present = await makeModule({ "todo.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "todo-without-checkboxes" });
	});

	it("refuses a lone brief with no items", async () => {
		const present = await makeModule({ "brief.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "brief-without-plan", items: [] });
	});

	it("never reads the checkboxes of a lone brief", async () => {
		const present = await makeModule({ "brief.aide": "- [ ] not a gate\n" });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "brief-without-plan", items: [] });
	});

	it("refuses a brief plus a fully checked todo with no plan", async () => {
		const present = await makeModule({ "brief.aide": NO_CHECKBOXES, "todo.aide": CHECKED });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "brief-without-plan", items: [] });
	});

	it("names the todo's unchecked item when a brief has no plan", async () => {
		const present = await makeModule({ "brief.aide": NO_CHECKBOXES, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "brief-without-plan",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("returns null for a fully checked plan with no todo", async () => {
		const present = await makeModule({ "plan.aide": CHECKED });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("returns null for a fully checked plan plus a fully checked todo", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": CHECKED });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("returns an unchecked plan item with file, line and text", async () => {
		const present = await makeModule({ "plan.aide": UNCHECKED_PLAN });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "plan.aide", line: 2, text: "open plan item" }],
		});
	});

	it("returns an unchecked todo item with file, line and text", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("returns unchecked items from both files, plan first", async () => {
		const present = await makeModule({ "plan.aide": UNCHECKED_PLAN, "todo.aide": UNCHECKED_TODO });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "unchecked-items",
			items: [
				{ file: "plan.aide", line: 2, text: "open plan item" },
				{ file: "todo.aide", line: 3, text: "open todo item" },
			],
		});
	});

	it("refuses a plan with zero checkboxes", async () => {
		const present = await makeModule({ "plan.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "plan-without-checkboxes" });
	});

	it("allows a todo with zero checkboxes alongside a checked plan", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "todo.aide": NO_CHECKBOXES });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("never lets a status-less brief.aide's checkboxes block", async () => {
		const present = await makeModule({ "plan.aide": CHECKED, "brief.aide": "- [ ] not a gate\n" });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});
});

describe("checkPreconditions with a recorded status", () => {
	it("refuses a completed plan plus a completed brief that holds an open item, naming brief.aide", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("completed", CHECKED),
			"brief.aide": withStatus("completed", "- [x] done\n- [ ] still open\n"),
		});
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "completed-with-open-items",
			items: [{ file: "brief.aide", line: 5, text: "still open" }],
		});
	});

	it("passes a completed plan plus a completed brief", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("completed", CHECKED),
			"brief.aide": withStatus("completed", ""),
		});
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it.each(["approved", "proposed"])("refuses a completed plan plus a %s brief, naming brief.aide", async (status) => {
		const present = await makeModule({
			"plan.aide": withStatus("completed", CHECKED),
			"brief.aide": withStatus(status, ""),
		});
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "open-status",
			files: [{ file: "brief.aide", status }],
			items: [],
		});
	});

	it("passes a completed plan plus a brief with no status", async () => {
		const present = await makeModule({ "plan.aide": withStatus("completed", CHECKED), "brief.aide": "# Brief\n" });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("refuses a completed plan with one open item, naming it", async () => {
		const present = await makeModule({ "plan.aide": withStatus("completed", UNCHECKED_PLAN) });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "completed-with-open-items",
			items: [{ file: "plan.aide", line: 5, text: "open plan item" }],
		});
	});

	it("passes a completed plan with zero checkboxes", async () => {
		const present = await makeModule({ "plan.aide": withStatus("completed", NO_CHECKBOXES) });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it.each(["proposed", "approved"])("refuses a fully checked %s plan as open-status", async (status) => {
		const present = await makeModule({ "plan.aide": withStatus(status, CHECKED) });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "open-status",
			files: [{ file: "plan.aide", status }],
			items: [],
		});
	});

	it("lists every open-status file in plan, todo, brief order with the plan and todo items", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("approved", UNCHECKED_PLAN),
			"todo.aide": withStatus("proposed", UNCHECKED_TODO),
			"brief.aide": withStatus("approved", ""),
		});
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "open-status",
			files: [
				{ file: "plan.aide", status: "approved" },
				{ file: "todo.aide", status: "proposed" },
				{ file: "brief.aide", status: "approved" },
			],
			items: [
				{ file: "plan.aide", line: 5, text: "open plan item" },
				{ file: "todo.aide", line: 6, text: "open todo item" },
			],
		});
	});

	it("passes an abandoned plan with open items plus an approved brief", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("abandoned", UNCHECKED_PLAN),
			"brief.aide": withStatus("approved", ""),
		});
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it.each(["approved", "proposed"])("refuses an abandoned plan plus a %s todo, naming only todo.aide", async (status) => {
		const present = await makeModule({
			"plan.aide": withStatus("abandoned", UNCHECKED_PLAN),
			"todo.aide": withStatus(status, CHECKED),
			"brief.aide": withStatus("approved", ""),
		});
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "open-status",
			files: [{ file: "todo.aide", status }],
			items: [],
		});
	});

	it("passes an abandoned plan plus an abandoned todo with open items", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("abandoned", UNCHECKED_PLAN),
			"todo.aide": withStatus("abandoned", UNCHECKED_TODO),
		});
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("refuses an abandoned plan plus a status-less todo with open items, naming only the todo items", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("abandoned", UNCHECKED_PLAN),
			"todo.aide": UNCHECKED_TODO,
		});
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "unchecked-items",
			items: [{ file: "todo.aide", line: 3, text: "open todo item" }],
		});
	});

	it("passes an abandoned todo with open items and no plan", async () => {
		const present = await makeModule({ "todo.aide": withStatus("abandoned", UNCHECKED_TODO) });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it("passes a completed todo, all checked, with no plan", async () => {
		const present = await makeModule({ "todo.aide": withStatus("completed", CHECKED) });
		expect(await checkPreconditions(dir, present)).toBeNull();
	});

	it.each(["proposed", "approved"])("refuses a fully checked %s todo with no plan as open-status", async (status) => {
		const present = await makeModule({ "todo.aide": withStatus(status, CHECKED) });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "open-status",
			files: [{ file: "todo.aide", status }],
			items: [],
		});
	});

	it("refuses a completed todo with an open item and no plan", async () => {
		const present = await makeModule({ "todo.aide": withStatus("completed", UNCHECKED_TODO) });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "completed-with-open-items",
			items: [{ file: "todo.aide", line: 6, text: "open todo item" }],
		});
	});

	it("refuses a brief plus an abandoned todo with no plan, carrying no items", async () => {
		const present = await makeModule({
			"brief.aide": NO_CHECKBOXES,
			"todo.aide": withStatus("abandoned", UNCHECKED_TODO),
		});
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "brief-without-plan", items: [] });
	});

	it("refuses an abandoned brief alone", async () => {
		const present = await makeModule({ "brief.aide": withStatus("abandoned", "") });
		expect(await checkPreconditions(dir, present)).toEqual({ kind: "brief-without-plan", items: [] });
	});

	it("refuses a plan recording status: done as invalid-status naming plan.aide", async () => {
		const present = await makeModule({ "plan.aide": withStatus("done", CHECKED) });
		expect(await checkPreconditions(dir, present)).toEqual({
			kind: "invalid-status",
			file: "plan.aide",
			detail: 'status "done" is not a valid status here',
		});
	});

	it("refuses a brief with unparsable frontmatter beside a completed plan", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("completed", CHECKED),
			"brief.aide": "---\nkey: [unclosed\n---\n",
		});
		expect(await checkPreconditions(dir, present)).toMatchObject({
			kind: "invalid-status",
			file: "brief.aide",
			detail: expect.stringContaining("its frontmatter cannot be parsed"),
		});
	});

	it("does not judge the same brief beside an abandoned plan", async () => {
		const present = await makeModule({
			"plan.aide": withStatus("abandoned", UNCHECKED_PLAN),
			"brief.aide": "---\nkey: [unclosed\n---\n",
		});
		expect(await checkPreconditions(dir, present)).toBeNull();
	});
});
