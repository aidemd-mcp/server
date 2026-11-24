import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import expandRow from "./index.js";

function row({ id, kind, files = [] }: { id: string; kind: HistoryKind; files?: HistoryRowModel[] }): HistoryRowModel {
	return { id, sessionId: "s1", time: "14:00", day: "Today", kind, ...KIND_FACTS[kind], label: id, mono: null, meta: null, sessionTag: null, item: null, files };
}

const ids = (rows: HistoryRowModel[]): string[] => rows.map((entry) => entry.id);

describe("expandRow", () => {
	const group = row({ id: "group", kind: "files", files: [row({ id: "a", kind: "sub" }), row({ id: "b", kind: "sub" })] });

	it("is the row alone when it holds no file group", () => {
		expect(ids(expandRow({ row: row({ id: "x", kind: "phase" }), filesOnly: false }))).toEqual(["x"]);
	});

	it("is the row, its group line and a line per path", () => {
		expect(ids(expandRow({ row: row({ id: "step", kind: "step", files: [group] }), filesOnly: false }))).toEqual(["step", "group", "a", "b"]);
	});

	it("leaves the row out with `filesOnly`, and draws nothing for a row with no group", () => {
		expect(ids(expandRow({ row: row({ id: "step", kind: "step", files: [group] }), filesOnly: true }))).toEqual(["group", "a", "b"]);
		expect(expandRow({ row: row({ id: "x", kind: "phase" }), filesOnly: true })).toEqual([]);
	});

	it("draws a standalone group as itself and its paths, with or without `filesOnly`", () => {
		expect(ids(expandRow({ row: group, filesOnly: false }))).toEqual(["group", "a", "b"]);
		expect(ids(expandRow({ row: group, filesOnly: true }))).toEqual(["group", "a", "b"]);
	});
});
