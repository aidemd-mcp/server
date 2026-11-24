import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import countCategories from "./index.js";

function row({ kind, files = [] }: { kind: HistoryKind; files?: HistoryRowModel[] }): HistoryRowModel {
	return { id: kind, sessionId: "s1", time: "14:00", day: "Today", kind, ...KIND_FACTS[kind], label: kind, mono: null, meta: null, sessionTag: null, item: null, files };
}

describe("countCategories", () => {
	it("counts each row under its category", () => {
		const rows = [row({ kind: "start" }), row({ kind: "phase" }), row({ kind: "done" }), row({ kind: "step" }), row({ kind: "wait" }), row({ kind: "issues" }), row({ kind: "pass" })];
		expect(countCategories({ rows })).toEqual({ sessions: 1, phases: 3, gates: 1, qa: 2 });
	});

	it("counts a row that holds a file group once more under files, and a standalone group once", () => {
		const group = row({ kind: "files", files: [row({ kind: "sub" })] });
		const rows = [row({ kind: "step", files: [group] }), group, row({ kind: "step" })];
		expect(countCategories({ rows })).toEqual({ phases: 2, files: 2 });
	});

	it("is empty with no rows", () => {
		expect(countCategories({ rows: [] })).toEqual({});
	});
});
