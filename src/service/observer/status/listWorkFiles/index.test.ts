import { describe, it, expect } from "vitest";
import listWorkFiles from "./index.js";
import type { ModuleNode, TreeFileEntry } from "../types/index.js";

function makeWork(
	kind: "plan" | "todo" | "brief",
	file: string,
	progress = { done: 1, total: 2, open: 1 },
): TreeFileEntry {
	return {
		kind,
		file,
		folder: file.slice(0, file.lastIndexOf("/")),
		read: {
			state: "present",
			status: "approved",
			awaitingApproval: false,
			progress,
			steps: { done: progress.done, total: progress.total },
		},
	};
}

function makeNode(folder: string, files: TreeFileEntry[]): ModuleNode {
	return { folder, parent: ".", files };
}

describe("listWorkFiles", () => {
	it("lists plans and todos across modules in path order with their progress", () => {
		const nodes = [
			makeNode("src/b", [makeWork("plan", "src/b/plan.aide", { done: 3, total: 4, open: 1 })]),
			makeNode("src/a", [
				makeWork("plan", "src/a/plan.aide"),
				makeWork("todo", "src/a/todo.aide", { done: 0, total: 2, open: 2 }),
			]),
		];

		const result = listWorkFiles({ nodes });

		expect(result.map((e) => e.file)).toEqual(["src/a/plan.aide", "src/a/todo.aide", "src/b/plan.aide"]);
		const progress = result.map((e) => (e.read.state === "present" ? e.read.progress : null));
		expect(progress).toEqual([
			{ done: 1, total: 2, open: 1 },
			{ done: 0, total: 2, open: 2 },
			{ done: 3, total: 4, open: 1 },
		]);
	});

	it("lists a malformed plan with its error", () => {
		const malformed: TreeFileEntry = {
			kind: "plan",
			file: "src/a/plan.aide",
			folder: "src/a",
			read: { state: "malformed", error: "no frontmatter" },
		};

		const result = listWorkFiles({ nodes: [makeNode("src/a", [malformed])] });

		expect(result).toEqual([malformed]);
	});

	it("does not list briefs, specs or other kinds", () => {
		const intent: TreeFileEntry = {
			kind: "intent",
			file: "src/a/.aide",
			folder: "src/a",
			read: {
				state: "present",
				alignment: "aligned",
				description: "",
				progress: { done: 0, total: 0, open: 0 },
			},
		};
		const session: TreeFileEntry = {
			kind: "session",
			file: ".aide/session.aide",
			folder: ".",
			read: { state: "present", progress: { done: 0, total: 0, open: 0 } },
		};

		const result = listWorkFiles({
			nodes: [makeNode("src/a", [intent, makeWork("brief", "src/a/brief.aide"), session])],
		});

		expect(result).toEqual([]);
	});
});
