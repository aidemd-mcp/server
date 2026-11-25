import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryListItem, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import buildHistoryList from "./index.js";

function row({
	id,
	kind,
	day = "Today",
	sessionId = "s1",
	files = [],
}: {
	id: string;
	kind: HistoryKind;
	day?: string;
	sessionId?: string;
	files?: HistoryRowModel[];
}): HistoryRowModel {
	return { id, sessionId, time: "14:00", day, kind, ...KIND_FACTS[kind], label: id, mono: null, meta: null, sessionTag: null, item: null, files };
}

function describeList(list: HistoryListItem[]): string[] {
	return list.map((item) => (item.kind === "day" ? `# ${item.text}` : item.row.id));
}

const SUB = row({ id: "sub-1", kind: "sub" });
const GROUP = row({ id: "group", kind: "files", files: [SUB] });
const ROWS = [
	row({ id: "start", kind: "start" }),
	row({ id: "phase", kind: "phase" }),
	row({ id: "step", kind: "step", files: [GROUP] }),
	row({ id: "wait", kind: "wait" }),
	row({ id: "commit", kind: "commit" }),
];

describe("buildHistoryList", () => {
	it("runs newest first by default, with a header that says so, each row followed by its file group", () => {
		expect(describeList(buildHistoryList({ rows: ROWS, type: "all", session: "all", newest: true }))).toEqual([
			"# Today · newest first",
			"commit",
			"wait",
			"step",
			"group",
			"sub-1",
			"phase",
			"start",
		]);
	});

	it("runs oldest first, with a header that says so", () => {
		expect(describeList(buildHistoryList({ rows: ROWS, type: "all", session: "all", newest: false }))).toEqual([
			"# Today · oldest first",
			"start",
			"phase",
			"step",
			"group",
			"sub-1",
			"wait",
			"commit",
		]);
	});

	it("keeps the rows of one category, with the file group under a kept row", () => {
		expect(describeList(buildHistoryList({ rows: ROWS, type: "phases", session: "all", newest: false }))).toEqual(["# Today · oldest first", "phase", "step", "group", "sub-1"]);
		expect(describeList(buildHistoryList({ rows: ROWS, type: "gates", session: "all", newest: false }))).toEqual(["# Today · oldest first", "wait"]);
	});

	it("lists only the file groups under the Files filter, without the rows they hang under", () => {
		expect(describeList(buildHistoryList({ rows: ROWS, type: "files", session: "all", newest: false }))).toEqual(["# Today · oldest first", "group", "sub-1"]);
	});

	it("keeps one session's rows", () => {
		const rows = [row({ id: "a", kind: "phase", sessionId: "a" }), row({ id: "b", kind: "phase", sessionId: "b" })];
		expect(describeList(buildHistoryList({ rows, type: "all", session: "b", newest: false }))).toEqual(["# Today · oldest first", "b"]);
	});

	it("opens a new day header whenever the day changes, only the first carrying the order", () => {
		const rows = [row({ id: "old", kind: "phase", day: "Yesterday" }), row({ id: "new", kind: "phase", day: "Today" })];
		expect(describeList(buildHistoryList({ rows, type: "all", session: "all", newest: true }))).toEqual(["# Today · newest first", "new", "# Yesterday", "old"]);
		expect(describeList(buildHistoryList({ rows, type: "all", session: "all", newest: false }))).toEqual(["# Yesterday · oldest first", "old", "# Today", "new"]);
	});

	it("is empty when nothing matches, and leaves the input as it was", () => {
		const rows = [...ROWS];
		expect(buildHistoryList({ rows, type: "errors", session: "all", newest: true })).toEqual([]);
		expect(rows).toEqual(ROWS);
	});
});
