import { describe, expect, it } from "vitest";
import type { CleanupRefusal, CleanupResult } from "@/types/index.js";
import formatReport from "./index.js";

describe("formatReport — success kinds", () => {
	it("lists one Removed line per file with module-prefixed paths", () => {
		const report = formatReport({
			kind: "removed",
			module: "src/x",
			files: ["brief.aide", "plan.aide"],
		});
		expect(report.isError).toBe(false);
		expect(report.text.split("\n")).toEqual(["Removed src/x/brief.aide", "Removed src/x/plan.aide"]);
	});

	it("drops the module prefix for the root module", () => {
		const report = formatReport({ kind: "removed", module: ".", files: ["plan.aide"] });
		expect(report.text).toBe("Removed plan.aide");
	});

	it("marks a dry run as removing nothing and lists the files a real call would remove", () => {
		const report = formatReport({
			kind: "would-remove",
			module: "src/x",
			files: ["todo.aide", "plan.aide"],
		});
		expect(report.isError).toBe(false);
		const [first, ...rest] = report.text.split("\n");
		expect(first).toMatch(/dry run/i);
		expect(first).toMatch(/nothing was removed/i);
		expect(rest).toEqual(["Would remove src/x/todo.aide", "Would remove src/x/plan.aide"]);
	});
});

describe("formatReport — refused", () => {
	const simple: [CleanupRefusal, RegExp][] = [
		[{ kind: "outside-root" }, /outside the project root/],
		[{ kind: "missing" }, /no such directory/],
		[{ kind: "not-a-directory" }, /not a directory/],
		[{ kind: "not-a-file", file: "todo.aide" }, /src\/x\/todo\.aide is not a regular file/],
		[{ kind: "no-ephemerals" }, /no plan\.aide, todo\.aide or brief\.aide here/],
		[
			{ kind: "brief-without-plan", items: [] },
			/src\/x\/brief\.aide has no plan\.aide beside it.*removed only together with its plan\./,
		],
		[{ kind: "todo-without-checkboxes" }, /src\/x\/todo\.aide has no checkboxes/],
		[{ kind: "plan-without-checkboxes" }, /no checkboxes/],
	];

	it.each(simple)("reports %j as an error naming the module and the reason", (refusal, reason) => {
		const report = formatReport({ kind: "refused", module: "src/x", refusal });
		expect(report.isError).toBe(true);
		const [first] = report.text.split("\n");
		expect(first).toContain("src/x");
		expect(first).toMatch(/refused/);
		expect(first).toMatch(/nothing was removed/i);
		expect(report.text).toMatch(reason);
	});

	it("reports a plan without checkboxes as the header line plus one reason line", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "plan-without-checkboxes" },
		});
		expect(report.text.split("\n")).toEqual([
			"Cleanup of src/x was refused. Nothing was removed.",
			"Reason: plan.aide has no checkboxes to verify, so completion cannot be shown.",
		]);
	});

	it("names one open-status file with its status and no items", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "open-status", files: [{ file: "plan.aide", status: "proposed" }], items: [] },
		});
		expect(report.isError).toBe(true);
		expect(report.text.split("\n")).toEqual([
			"Cleanup of src/x was refused. Nothing was removed.",
			"Reason: src/x/plan.aide is recorded proposed, so its cycle has not closed.",
		]);
	});

	it("names every open-status file in order, then the items", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: {
				kind: "open-status",
				files: [
					{ file: "plan.aide", status: "approved" },
					{ file: "brief.aide", status: "proposed" },
				],
				items: [{ file: "plan.aide", line: 4, text: "Wire it" }],
			},
		});
		expect(report.text.split("\n")).toEqual([
			"Cleanup of src/x was refused. Nothing was removed.",
			"Reason: src/x/plan.aide is recorded approved, so its cycle has not closed.",
			"Reason: src/x/brief.aide is recorded proposed, so its cycle has not closed.",
			"1 unchecked item remain:",
			"src/x/plan.aide:4: Wire it",
		]);
	});

	it("renders open-status paths without a prefix for the root module", () => {
		const report = formatReport({
			kind: "refused",
			module: ".",
			refusal: { kind: "open-status", files: [{ file: "todo.aide", status: "approved" }], items: [] },
		});
		expect(report.text).toContain("Reason: todo.aide is recorded approved, so its cycle has not closed.");
	});

	it("names the unchecked items of a completed file", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: {
				kind: "completed-with-open-items",
				items: [
					{ file: "plan.aide", line: 9, text: "Ship it" },
					{ file: "todo.aide", line: 2, text: "Fix it" },
				],
			},
		});
		expect(report.isError).toBe(true);
		expect(report.text.split("\n")).toEqual([
			"Cleanup of src/x was refused. Nothing was removed.",
			"Reason: a file recorded completed still has unchecked items.",
			"2 unchecked items remain:",
			"src/x/plan.aide:9: Ship it",
			"src/x/todo.aide:2: Fix it",
		]);
	});

	it("names the file and the detail of an unreadable status", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "invalid-status", file: "plan.aide", detail: 'status "done" is not a valid status here' },
		});
		expect(report.isError).toBe(true);
		expect(report.text.split("\n")).toEqual([
			"Cleanup of src/x was refused. Nothing was removed.",
			'Reason: src/x/plan.aide has a status cleanup cannot read: status "done" is not a valid status here.',
		]);
	});

	it("names every unchecked item with its file, line and text", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: {
				kind: "unchecked-items",
				items: [
					{ file: "plan.aide", line: 12, text: "Write the tests" },
					{ file: "todo.aide", line: 3, text: "Fix the edge case" },
				],
			},
		});
		expect(report.isError).toBe(true);
		const lines = report.text.split("\n");
		expect(lines[1]).toContain("2 unchecked items");
		expect(lines).toContain("src/x/plan.aide:12: Write the tests");
		expect(lines).toContain("src/x/todo.aide:3: Fix the edge case");
	});

	it("uses root-relative item paths for the root module", () => {
		const report = formatReport({
			kind: "refused",
			module: ".",
			refusal: { kind: "unchecked-items", items: [{ file: "plan.aide", line: 1, text: "Do it" }] },
		});
		expect(report.text).toContain("plan.aide:1: Do it");
		expect(report.text).toContain("1 unchecked item remain");
	});
});

describe("formatReport — refusals without a plan", () => {
	it("prints the brief reason, then the count line and each todo item", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: {
				kind: "brief-without-plan",
				items: [
					{ file: "todo.aide", line: 3, text: "Fix the edge case" },
					{ file: "todo.aide", line: 5, text: "Add the test" },
				],
			},
		});
		const lines = report.text.split("\n");
		expect(lines[1]).toMatch(/src\/x\/brief\.aide has no plan\.aide beside it/);
		expect(lines[2]).toBe("2 unchecked items remain:");
		expect(lines[3]).toBe("src/x/todo.aide:3: Fix the edge case");
		expect(lines[4]).toBe("src/x/todo.aide:5: Add the test");
	});

	it("prints no count line and no unchecked text when the brief refusal has no items", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "brief-without-plan", items: [] },
		});
		expect(report.text).not.toMatch(/unchecked/);
		expect(report.text.split("\n")).toHaveLength(2);
	});

	const noAdvice: CleanupRefusal[] = [
		{ kind: "no-ephemerals" },
		{ kind: "brief-without-plan", items: [] },
		{ kind: "todo-without-checkboxes" },
		{ kind: "plan-without-checkboxes" },
		{ kind: "open-status", files: [{ file: "plan.aide", status: "approved" }], items: [] },
		{ kind: "completed-with-open-items", items: [{ file: "plan.aide", line: 1, text: "Do it" }] },
		{ kind: "invalid-status", file: "plan.aide", detail: 'status "done" is not a valid status here' },
	];

	it.each(noAdvice)("never gives advice on creating a file or changing a status for %j", (refusal) => {
		const { text } = formatReport({ kind: "refused", module: "src/x", refusal });
		expect(text).not.toContain("allowEmptyPlan");
		expect(text).not.toContain("aide_frontmatter");
		expect(text).not.toContain("create");
		expect(text).not.toContain("mark");
		expect(text).not.toContain("set the status");
	});

	it("renders the root module without a module prefix", () => {
		const report = formatReport({
			kind: "refused",
			module: ".",
			refusal: { kind: "brief-without-plan", items: [] },
		});
		expect(report.text).toContain("Reason: brief.aide has no plan.aide beside it, and a brief is removed only together with its plan.");
	});
});

describe("formatReport — incomplete", () => {
	const result: CleanupResult = {
		kind: "incomplete",
		module: "src/x",
		removed: ["brief.aide"],
		remaining: ["todo.aide", "plan.aide"],
		error: "EPERM: locked",
	};

	it("is an error that never reads as success", () => {
		const report = formatReport(result);
		expect(report.isError).toBe(true);
		expect(report.text).toMatch(/did NOT complete/);
		expect(report.text).not.toMatch(/^Removed src\/x\/plan\.aide/m);
	});

	it("names every removed file, every remaining file and the error", () => {
		const { text } = formatReport(result);
		expect(text).toContain("Removed src/x/brief.aide");
		expect(text).toContain("Still present src/x/todo.aide");
		expect(text).toContain("Still present src/x/plan.aide");
		expect(text).toContain("EPERM: locked");
	});
});

describe("formatReport — forbidden content", () => {
	const results: CleanupResult[] = [
		{ kind: "removed", module: "src/x", files: ["plan.aide"] },
		{ kind: "would-remove", module: "src/x", files: ["plan.aide"] },
		{ kind: "refused", module: "src/x", refusal: { kind: "brief-without-plan", items: [] } },
		{ kind: "incomplete", module: "src/x", removed: [], remaining: ["plan.aide"], error: "boom" },
	];

	it.each(results)("never mentions session.aide or a shell delete for $kind", (result) => {
		const { text } = formatReport(result);
		expect(text).not.toMatch(/session\.aide/);
		expect(text).not.toMatch(/\brm\b|\bdel\b|Remove-Item/);
	});
});
