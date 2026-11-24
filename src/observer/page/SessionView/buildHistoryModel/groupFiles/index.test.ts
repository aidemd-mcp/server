import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import groupFiles from "./index.js";

function row({ id, kind, sessionId = "s1", label = id, time = "14:00" }: { id: string; kind: HistoryKind; sessionId?: string; label?: string; time?: string }): HistoryRowModel {
	return {
		id: `${sessionId}:${id}`,
		sessionId,
		time,
		day: "Today",
		kind,
		...KIND_FACTS[kind],
		label,
		mono: null,
		meta: null,
		sessionTag: null,
		item: { kind: "event", sessionId, seq: 1 },
		files: [],
	};
}

describe("groupFiles", () => {
	it("folds a run of file writes under the row before it as `Wrote <n> files`, one sub row per path, without a time", () => {
		const rows = [row({ id: "step", kind: "step" }), row({ id: "a", kind: "sub", label: "src/a.ts" }), row({ id: "b", kind: "sub", label: "src/b.ts" }), row({ id: "next", kind: "phase" })];
		const grouped = groupFiles({ rows });

		expect(grouped.map((entry) => entry.kind)).toEqual(["step", "phase"]);
		const group = grouped[0]!.files[0]!;
		expect(group).toMatchObject({ kind: "files", label: "Wrote 2 files", time: "", day: "Today", item: rows[0]!.item, sessionTag: null });
		expect(group.files.map((sub) => [sub.kind, sub.label, sub.time])).toEqual([
			["sub", "src/a.ts", ""],
			["sub", "src/b.ts", ""],
		]);
		expect(grouped[1]!.files).toEqual([]);
	});

	it("says `Wrote 1 file` for a single write", () => {
		const grouped = groupFiles({ rows: [row({ id: "done", kind: "done" }), row({ id: "a", kind: "sub" })] });
		expect(grouped[0]!.files[0]!.label).toBe("Wrote 1 file");
	});

	it("stands a run with no row before it in its session as its own files row, with the first write's time", () => {
		const grouped = groupFiles({ rows: [row({ id: "a", kind: "sub", time: "14:05" }), row({ id: "b", kind: "sub", time: "14:06" })] });
		expect(grouped).toHaveLength(1);
		expect(grouped[0]).toMatchObject({ kind: "files", label: "Wrote 2 files", time: "14:05", item: null });
		expect(grouped[0]!.files.map((sub) => sub.time)).toEqual(["", ""]);
	});

	it("keeps each session's run with that session's own row when two sessions interleave", () => {
		const rows = [
			row({ id: "x", kind: "done", sessionId: "s1" }),
			row({ id: "y", kind: "pass", sessionId: "s2" }),
			row({ id: "a", kind: "sub", sessionId: "s1", label: "s1-file" }),
			row({ id: "b", kind: "sub", sessionId: "s2", label: "s2-file" }),
		];
		const grouped = groupFiles({ rows });
		expect(grouped.map((entry) => entry.sessionId)).toEqual(["s1", "s2"]);
		expect(grouped[0]!.files[0]!.files.map((sub) => sub.label)).toEqual(["s1-file"]);
		expect(grouped[1]!.files[0]!.files.map((sub) => sub.label)).toEqual(["s2-file"]);
	});

	it("starts a new group after another row interrupts the run, and leaves the input rows as they were", () => {
		const rows = [
			row({ id: "one", kind: "step" }),
			row({ id: "a", kind: "sub" }),
			row({ id: "two", kind: "step" }),
			row({ id: "b", kind: "sub" }),
		];
		const grouped = groupFiles({ rows });
		expect(grouped.map((entry) => entry.files.map((group) => group.label))).toEqual([["Wrote 1 file"], ["Wrote 1 file"]]);
		expect(rows.every((entry) => entry.files.length === 0)).toBe(true);
	});
});
