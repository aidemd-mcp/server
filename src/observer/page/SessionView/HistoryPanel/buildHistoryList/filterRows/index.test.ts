import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import filterRows from "./index.js";

function row({ id, kind, sessionId = "s1", files = [] }: { id: string; kind: HistoryKind; sessionId?: string; files?: HistoryRowModel[] }): HistoryRowModel {
	return { id, sessionId, time: "14:00", day: "Today", kind, ...KIND_FACTS[kind], label: id, mono: null, meta: null, sessionTag: null, item: null, files };
}

const GROUP = row({ id: "group", kind: "files", files: [row({ id: "a", kind: "sub" })] });
const ROWS = [
	row({ id: "phase", kind: "phase" }),
	row({ id: "done", kind: "done", sessionId: "s2" }),
	row({ id: "step", kind: "step", files: [GROUP] }),
	row({ id: "alone", kind: "files", files: [row({ id: "b", kind: "sub" })] }),
	row({ id: "issues", kind: "issues" }),
	row({ id: "pass", kind: "pass" }),
	row({ id: "commit", kind: "commit" }),
	row({ id: "release", kind: "release" }),
	row({ id: "prompt", kind: "prompt" }),
];
const ids = (rows: HistoryRowModel[]): string[] => rows.map((entry) => entry.id);

describe("filterRows", () => {
	it("keeps every row under `all` for every session", () => {
		expect(filterRows({ rows: ROWS, type: "all", session: "all" })).toHaveLength(ROWS.length);
	});

	it.each([
		["phases", ["phase", "done", "step"]],
		["qa", ["issues", "pass"]],
		["commits", ["commit", "release"]],
		["prompts", ["prompt"]],
		["gates", []],
		["errors", []],
	] as const)("keeps the %s category", (type, expected) => {
		expect(ids(filterRows({ rows: ROWS, type, session: "all" }))).toEqual(expected);
	});

	it("keeps the rows that hold file writes under Files: the row a group hangs under and a standalone group", () => {
		expect(ids(filterRows({ rows: ROWS, type: "files", session: "all" }))).toEqual(["step", "alone"]);
	});

	it("keeps one session's rows, and combines with a type", () => {
		expect(ids(filterRows({ rows: ROWS, type: "all", session: "s2" }))).toEqual(["done"]);
		expect(ids(filterRows({ rows: ROWS, type: "phases", session: "s1" }))).toEqual(["phase", "step"]);
	});
});
