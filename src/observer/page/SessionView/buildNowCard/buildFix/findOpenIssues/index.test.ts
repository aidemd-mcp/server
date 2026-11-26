import { describe, expect, it } from "vitest";
import type { Status, WorkFileEntry } from "@/types/index.js";
import findOpenIssues from "./index.js";

function statusOf(workFiles: WorkFileEntry[]): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: "2026-01-01T10:00:00.000Z",
		tree: [],
		workFiles,
		sessionRecord: { state: "missing" },
		sessions: [],
		running: [],
		waiting: [],
		surfaced: null,
		rails: [],
		history: [],
		board: { state: "unavailable", reason: "no-kanban-field", detail: "", hint: "" },
		problems: [],
	};
}

const todo: WorkFileEntry = {
	kind: "todo",
	file: "src/a/todo.aide",
	folder: "src/a",
	read: { state: "present", status: "approved", awaitingApproval: false, progress: { done: 3, total: 5, open: 2 }, steps: { done: 3, total: 5 } },
};

describe("findOpenIssues", () => {
	it("reads the module's todo counts, whatever way the event wrote the module", () => {
		expect(findOpenIssues({ status: statusOf([todo]), module: "src/a" })).toEqual({ open: 2, total: 5 });
		expect(findOpenIssues({ status: statusOf([todo]), module: "/work/app/src/a/" })).toEqual({ open: 2, total: 5 });
	});

	it("is null with no todo for the module or an unreadable one", () => {
		expect(findOpenIssues({ status: statusOf([todo]), module: "src/b" })).toBeNull();
		expect(findOpenIssues({ status: statusOf([{ ...todo, read: { state: "malformed", error: "bad" } }]), module: "src/a" })).toBeNull();
	});
});
