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
		[{ kind: "no-plan" }, /no plan\.aide/],
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

	it("tells the caller allowEmptyPlan is only for an intentionally empty plan", () => {
		const report = formatReport({
			kind: "refused",
			module: "src/x",
			refusal: { kind: "plan-without-checkboxes" },
		});
		expect(report.text).toContain("allowEmptyPlan: true");
		expect(report.text).toMatch(/intentionally empty/);
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
		{ kind: "refused", module: "src/x", refusal: { kind: "no-plan" } },
		{ kind: "incomplete", module: "src/x", removed: [], remaining: ["plan.aide"], error: "boom" },
	];

	it.each(results)("never mentions session.aide or a shell delete for $kind", (result) => {
		const { text } = formatReport(result);
		expect(text).not.toMatch(/session\.aide/);
		expect(text).not.toMatch(/\brm\b|\bdel\b|Remove-Item/);
	});
});
