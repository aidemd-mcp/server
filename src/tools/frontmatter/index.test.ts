import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import frontmatter from "./index.js";
import formatResult from "./formatResult/index.js";
import type { FrontmatterOutcome } from "./types/index.js";

let container: string;
let root: string;

beforeEach(async () => {
	container = await realpath(await mkdtemp(join(tmpdir(), "frontmatter-e2e-")));
	root = join(container, "project");
	await mkdir(root);
});

afterEach(async () => {
	await rm(container, { recursive: true, force: true });
});

async function put(rel: string, content: string): Promise<void> {
	const abs = join(root, rel);
	await mkdir(dirname(abs), { recursive: true });
	await writeFile(abs, content, "utf-8");
}

const get = (rel: string): Promise<string> => readFile(join(root, rel), "utf-8");

const run = (path: string, field?: string, value?: string): Promise<FrontmatterOutcome> =>
	frontmatter(root, { path, field, value });

const text = (outcome: FrontmatterOutcome): string => formatResult(outcome).text;

/** The lines of a file, split on LF so a CRLF file keeps its \r on each line and still compares exactly. */
const lines = (content: string): string[] => content.split("\n");

/** Asserts `after` differs from `before` in exactly one line: one replaced, or one added. */
function expectOneLineDifference(before: string, after: string): void {
	const a = lines(before);
	const b = lines(after);
	if (b.length === a.length) {
		expect(b.filter((line, i) => line !== a[i])).toHaveLength(1);
		return;
	}
	expect(b.length).toBe(a.length + 1);
	const added = b.findIndex((line, i) => line !== a[i]);
	expect([...b.slice(0, added), ...b.slice(added + 1)]).toEqual(a);
}

const plan = (status: string | null, body = "- [x] one\n"): string =>
	`---\nintent: build it\n${status === null ? "" : `status: ${status}\n`}---\n\n${body}`;

describe("read mode", () => {
	it.each([
		["plan.aide", plan("approved"), "plan.aide — status: approved"],
		["todo.aide", plan("proposed"), "todo.aide — status: proposed"],
		["brief.aide", plan("completed"), "brief.aide — status: completed"],
		["spec/.aide", "---\nintent: x\nalignment: aligned\n---\n", "spec/.aide — alignment: aligned"],
		["old/.aide", "---\nintent: x\nstatus: misaligned\n---\n", "old/.aide — alignment: misaligned (recorded under the older name status)"],
		["none/.aide", "---\nintent: x\n---\n", "none/.aide — alignment: not set"],
		["bad/plan.aide", plan("in-flight"), 'bad/plan.aide — status: not valid ("in-flight")'],
		["quoted/plan.aide", plan('"in-flight"'), 'quoted/plan.aide — status: not valid ("in-flight")'],
		["comment/plan.aide", plan("in-flight # retired"), 'comment/plan.aide — status: not valid ("in-flight")'],
	])("reports %s and changes no byte", async (rel, content, expected) => {
		await put(rel, content);
		const outcome = await run(rel);
		expect(formatResult(outcome)).toEqual({ text: expected, isError: false });
		expect(await get(rel)).toBe(content);
	});
});

describe("plan lifecycle", () => {
	it("walks proposed to approved to completed and then refuses to leave a final value", async () => {
		await put("m/plan.aide", plan("proposed"));
		expect(text(await run("m/plan.aide", "status", "approved"))).toBe("m/plan.aide — status: proposed → approved");
		expect(text(await run("m/plan.aide", "status", "completed"))).toBe("m/plan.aide — status: approved → completed");
		const before = await get("m/plan.aide");
		const refused = await run("m/plan.aide", "status", "abandoned");
		expect(refused).toEqual({ kind: "refused", path: "m/plan.aide", refusal: { kind: "final", field: "status", value: "completed" } });
		expect(text(refused)).toBe("Refused: m/plan.aide — status is completed, which is final; it cannot change");
		expect(await get("m/plan.aide")).toBe(before);
	});

	it("allows approved back to proposed", async () => {
		await put("m/plan.aide", plan("approved"));
		expect(text(await run("m/plan.aide", "status", "proposed"))).toBe("m/plan.aide — status: approved → proposed");
		expect(await get("m/plan.aide")).toContain("status: proposed\n");
	});

	it("refuses proposed to completed naming the allowed next values", async () => {
		const content = plan("proposed");
		await put("m/plan.aide", content);
		const outcome = await run("m/plan.aide", "status", "completed");
		expect(text(outcome)).toBe(
			"Refused: m/plan.aide — status cannot move from proposed to completed; allowed next values: approved, abandoned",
		);
		expect(formatResult(outcome).isError).toBe(true);
		expect(await get("m/plan.aide")).toBe(content);
	});

	it("refuses completion while an item is open and leaves the file untouched", async () => {
		const content = plan("approved", "- [x] one\n- [ ] two\n");
		await put("m/plan.aide", content);
		const outcome = await run("m/plan.aide", "status", "completed");
		expect(outcome).toMatchObject({ kind: "refused", refusal: { kind: "open-items", items: [{ text: "two" }] } });
		expect(text(outcome)).toMatch(/^Refused: m\/plan\.aide — completed is refused while 1 item is unchecked:\nm\/plan\.aide:\d+: two$/);
		expect(await get("m/plan.aide")).toBe(content);
	});

	it("inserts status: proposed as the first frontmatter line of a plan without status", async () => {
		await put("m/plan.aide", plan(null));
		expect(text(await run("m/plan.aide", "status", "proposed"))).toBe("m/plan.aide — status: not set → proposed");
		expect(await get("m/plan.aide")).toBe(`---\nstatus: proposed\nintent: build it\n---\n\n- [x] one\n`);
	});

	it("will not jump a status-less plan to completed", async () => {
		await put("m/plan.aide", plan(null));
		expect(text(await run("m/plan.aide", "status", "completed"))).toBe(
			"Refused: m/plan.aide — status cannot move from not set to completed; allowed next values: proposed, approved, abandoned",
		);
	});

	it("reports the same value as no change with identical bytes", async () => {
		const content = plan("approved");
		await put("m/plan.aide", content);
		expect(text(await run("m/plan.aide", "status", "approved"))).toBe("m/plan.aide — status: approved (no change)");
		expect(await get("m/plan.aide")).toBe(content);
	});
});

describe("todo and brief lifecycles", () => {
	it("moves a todo list proposed to approved to completed", async () => {
		await put("m/todo.aide", plan("proposed", "- [x] fix\n"));
		expect(text(await run("m/todo.aide", "status", "approved"))).toBe("m/todo.aide — status: proposed → approved");
		expect(text(await run("m/todo.aide", "status", "completed"))).toBe("m/todo.aide — status: approved → completed");
	});

	it("abandons a proposed todo list", async () => {
		await put("m/todo.aide", plan("proposed", "- [ ] fix\n"));
		expect(text(await run("m/todo.aide", "status", "abandoned"))).toBe("m/todo.aide — status: proposed → abandoned");
	});

	it("completes a brief only after its plan is completed", async () => {
		await put("m/brief.aide", plan("proposed", "no boxes\n"));
		await put("m/plan.aide", plan("approved"));
		expect(text(await run("m/brief.aide", "status", "approved"))).toBe("m/brief.aide — status: proposed → approved");

		const refused = await run("m/brief.aide", "status", "completed");
		expect(text(refused)).toBe(
			"Refused: m/brief.aide — a brief is completed only after its plan; plan.aide beside it is approved",
		);

		await run("m/plan.aide", "status", "completed");
		expect(text(await run("m/brief.aide", "status", "completed"))).toBe("m/brief.aide — status: approved → completed");
	});

	it.each(["plan.aide", "todo.aide", "brief.aide"])("refuses the retired value in-flight on %s", async (name) => {
		const content = plan("approved");
		await put(`m/${name}`, content);
		expect(text(await run(`m/${name}`, "status", "in-flight"))).toBe(
			`Refused: m/${name} — in-flight is not a status value for ${
				{ "plan.aide": "a plan", "todo.aide": "a todo list", "brief.aide": "a brief" }[name]
			}; allowed values: proposed, approved, completed, abandoned`,
		);
		expect(await get(`m/${name}`)).toBe(content);
	});
});

describe("intent spec alignment", () => {
	const spec = (alignment: string) => `---\nintent: x\nalignment: ${alignment}\n---\nbody\n`;

	it("moves unreviewed to aligned to misaligned and back to unreviewed", async () => {
		await put("s/.aide", spec("unreviewed"));
		expect(text(await run("s/.aide", "alignment", "aligned"))).toBe("s/.aide — alignment: unreviewed → aligned");
		expect(text(await run("s/.aide", "alignment", "misaligned"))).toBe("s/.aide — alignment: aligned → misaligned");
		expect(text(await run("s/.aide", "alignment", "unreviewed"))).toBe("s/.aide — alignment: misaligned → unreviewed");
		expect(await get("s/.aide")).toBe(spec("unreviewed"));
	});

	it("moves a legacy status line to alignment and reports the move", async () => {
		await put("s/.aide", "---\nintent: x\nstatus: aligned\n---\nbody\n");
		expect(text(await run("s/.aide", "alignment", "aligned"))).toBe(
			"s/.aide — alignment: aligned → aligned (moved from the older name status)",
		);
		const after = await get("s/.aide");
		expect(after).toBe(spec("aligned"));
		expect(after).not.toMatch(/^status:/m);
	});

	it("adds alignment after scope for a spec with neither", async () => {
		await put("s/.aide", "---\nscope: src/s\nintent: x\n---\nbody\n");
		expect(text(await run("s/.aide", "alignment", "unreviewed"))).toBe("s/.aide — alignment: not set → unreviewed");
		expect(await get("s/.aide")).toBe("---\nscope: src/s\nalignment: unreviewed\nintent: x\n---\nbody\n");
	});
});

describe("refusals leave the file byte-identical", () => {
	it.each([
		["status on an intent spec", "s/.aide", "---\nintent: x\nalignment: aligned\n---\n", "status", "approved", "Refused: s/.aide — an intent spec carries alignment, not status"],
		["alignment on a plan", "m/plan.aide", plan("approved"), "alignment", "aligned", "Refused: m/plan.aide — a plan carries status, not alignment"],
		[
			"description as the field",
			"m/plan.aide",
			plan("approved"),
			"description",
			"x",
			"Refused: m/plan.aide — description is not a governed field; the governed fields are alignment (intent specs) and status (plans, todo lists and briefs)",
		],
		["an unknown value", "m/plan.aide", plan("approved"), "status", "bogus", "Refused: m/plan.aide — bogus is not a status value for a plan; allowed values: proposed, approved, completed, abandoned"],
		["unparsable frontmatter", "m/plan.aide", "---\nstatus: [unclosed\n---\n", "status", "approved", null],
		["a multi-line value", "m/plan.aide", "---\nstatus: >\n  approved\n---\n", "status", "completed", "Refused: m/plan.aide — its status value spans more than one line, so it cannot be changed safely"],
		["a file with no frontmatter block", "m/plan.aide", "# no block\n", "status", "proposed", "Refused: m/plan.aide — it has no frontmatter block to hold status"],
	] as [string, string, string, string, string, string | null][])("%s", async (_name, rel, content, field, value, expected) => {
		await put(rel, content);
		const outcome = await run(rel, field, value);
		expect(formatResult(outcome).isError).toBe(true);
		if (expected === null) expect(text(outcome)).toMatch(/^Refused: m\/plan\.aide — its frontmatter cannot be parsed \([\s\S]+\)$/);
		else expect(text(outcome)).toBe(expected);
		expect(await get(rel)).toBe(content);
	});

	it("refuses field without value and value without field", async () => {
		const content = plan("approved");
		await put("m/plan.aide", content);
		const expected = "Refused: m/plan.aide — field and value go together; pass both to change a value, or neither to read";
		expect(text(await run("m/plan.aide", "status"))).toBe(expected);
		expect(text(await run("m/plan.aide", undefined, "completed"))).toBe(expected);
		expect(await get("m/plan.aide")).toBe(content);
	});

	it.each([
		[".aide/session.aide", "Refused: .aide/session.aide — the session record carries no governed values"],
		["m/research.aide", "Refused: m/research.aide — a research spec carries no governed values"],
		[".aide/config/brain.aide", "Refused: .aide/config/brain.aide — brain.aide is configuration and carries no governed values"],
		["notes.md", "Refused: notes.md — not an AIDE file; only .aide files carry governed values"],
	])("refuses %s in both modes", async (rel, expected) => {
		const content = "---\nstatus: approved\n---\n";
		await put(rel, content);
		expect(text(await run(rel))).toBe(expected);
		expect(text(await run(rel, "status", "completed"))).toBe(expected);
		expect(await get(rel)).toBe(content);
	});

	it("refuses a path that leaves the root", async () => {
		const outside = join(container, "x.aide");
		await writeFile(outside, "---\nalignment: aligned\n---\n", "utf-8");
		expect(text(await run("../x.aide", "alignment", "misaligned"))).toBe(
			"Refused: ../x.aide — the path resolves outside the project root",
		);
		expect(await readFile(outside, "utf-8")).toBe("---\nalignment: aligned\n---\n");
	});

	it("refuses an unparsable file in read mode", async () => {
		await put("m/plan.aide", "---\nstatus: [unclosed\n---\n");
		expect(formatResult(await run("m/plan.aide")).isError).toBe(true);
	});

	it("refuses a both-names spec in read and write mode", async () => {
		const content = "---\nintent: x\nalignment: aligned\nstatus: misaligned\n---\n";
		await put("s/.aide", content);
		const expected =
			"Refused: s/.aide — it records alignment under both alignment and the older name status, so its alignment is ambiguous";
		expect(text(await run("s/.aide"))).toBe(expected);
		expect(text(await run("s/.aide", "alignment", "unreviewed"))).toBe(expected);
		expect(await get("s/.aide")).toBe(content);
	});

	it("never creates a file: a missing path refuses missing and stays absent", async () => {
		const outcome = await run("m/plan.aide", "status", "approved");
		expect(text(outcome)).toBe("Refused: m/plan.aide — no such file");
		await expect(access(join(root, "m/plan.aide"))).rejects.toThrow();
	});
});

describe("every successful write changes exactly one line", () => {
	it.each([
		["LF", "\n"],
		["CRLF", "\r\n"],
	])("%s: replace and insert", async (_name, eol) => {
		const withStatus = `---${eol}intent: build it${eol}status: proposed${eol}---${eol}${eol}- [x] one${eol}`;
		await put("m/plan.aide", withStatus);
		await run("m/plan.aide", "status", "approved");
		const replaced = await get("m/plan.aide");
		expect(replaced).not.toBe(withStatus);
		expectOneLineDifference(withStatus, replaced);

		const withoutStatus = `---${eol}intent: build it${eol}---${eol}${eol}- [x] one${eol}`;
		await put("n/plan.aide", withoutStatus);
		await run("n/plan.aide", "status", "proposed");
		const inserted = await get("n/plan.aide");
		expectOneLineDifference(withoutStatus, inserted);
		expect(inserted).toContain(`status: proposed${eol}`);
	});
});
