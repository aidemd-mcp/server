import { describe, it, expect } from "vitest";
import buildTree from "./index.js";
import type { AideFile } from "@/types/index.js";

function makeAideFile(
	relativePath: string,
	type: AideFile["type"],
	summary = "",
	description = "",
	workStatus?: AideFile["workStatus"],
): AideFile {
	return {
		path: `/project/${relativePath}`,
		relativePath,
		type,
		summary,
		description,
		...(workStatus ? { workStatus } : {}),
	};
}

describe("buildTree", () => {
	it("renders a single file at root", () => {
		const files = [makeAideFile(".aide", "intent", "", "Root spec for the project")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("./");
		expect(tree).toContain(".aide [intent]");
		expect(tree).toContain("Root spec for the project");
	});

	it("groups files by directory", () => {
		const files = [
			makeAideFile("src/.aide", "intent", "Source spec"),
			makeAideFile("src/lib/.aide", "intent", "Lib spec"),
		];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("src/");
		expect(tree).toContain("src/lib/");
	});

	it("sorts files by type then name within a directory", () => {
		const files = [
			makeAideFile("src/research.aide", "research", "Research"),
			makeAideFile("src/intent.aide", "intent", "Intent"),
			makeAideFile("src/todo.aide", "todo", "Todo"),
		];
		const tree = buildTree(files, "/project");
		const lines = tree.split("\n");

		// intent should come before research, research before todo
		const intentIdx = lines.findIndex((l) => l.includes("[intent]"));
		const researchIdx = lines.findIndex((l) => l.includes("[research]"));
		const todoIdx = lines.findIndex((l) => l.includes("[todo]"));

		expect(intentIdx).toBeLessThan(researchIdx);
		expect(researchIdx).toBeLessThan(todoIdx);
	});

	it("uses tree-drawing characters", () => {
		const files = [
			makeAideFile("src/.aide", "intent", "First"),
			makeAideFile("src/research.aide", "research", "Second"),
		];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("├──");
		expect(tree).toContain("└──");
	});

	it("returns empty string for no files", () => {
		expect(buildTree([], "/project")).toBe("");
	});

	it("includes description after dash separator for intent files", () => {
		const files = [makeAideFile("src/.aide", "intent", "", "Strategy and contracts")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("— Strategy and contracts");
	});

	it.each(["proposed", "approved", "completed"] as const)(
		"renders a plan with workStatus %s as [plan: %s]",
		(workStatus) => {
			const files = [makeAideFile("src/plan.aide", "plan", "3/5 done", "", workStatus)];
			const tree = buildTree(files, "/project");

			expect(tree).toContain(`plan.aide [plan: ${workStatus}] — 3/5 done`);
		},
	);

	it.each(["approved", "abandoned"] as const)(
		"renders a todo with workStatus %s as [todo: %s]",
		(workStatus) => {
			const files = [makeAideFile("src/todo.aide", "todo", "1/2 done", "", workStatus)];
			const tree = buildTree(files, "/project");

			expect(tree).toContain(`todo.aide [todo: ${workStatus}] — 1/2 done`);
		},
	);

	it("renders a plan without workStatus as [plan]", () => {
		const files = [makeAideFile("src/plan.aide", "plan", "3/5 done")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("plan.aide [plan] — 3/5 done");
	});

	it("renders an intent file carrying a stray workStatus as [intent]", () => {
		const files = [makeAideFile("src/.aide", "intent", "", "Spec", "approved")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain(".aide [intent] — Spec");
		expect(tree).not.toContain("[intent:");
	});
});
