import { describe, expect, it } from "vitest";
import type { TaskNote } from "@/observer/page/types/index.js";
import buildTaskDrawer from "./index.js";

const NOTE: TaskNote = {
	slug: "aide-score-misaligned-rank",
	column: "in-progress",
	markdown: "---\npriority: p1\ntype: bug\n---\n# aide_score ranks misaligned specs below unreviewed ones\n\nSorts by modified time.\n\n## Acceptance\n\n- Misaligned first\n",
	task: {
		state: "readable",
		slug: "aide-score-misaligned-rank",
		column: "in-progress",
		title: "aide_score ranks misaligned specs below unreviewed ones",
		priority: "p1",
		type: "bug",
		tags: [],
		inSession: false,
	},
};

describe("buildTaskDrawer", () => {
	it("is a Task with the title, the slug as meta and the column, priority and type as chips", () => {
		const drawer = buildTaskDrawer({ task: NOTE, linked: false, sessionStart: null });
		expect(drawer).toMatchObject({
			kind: "Task",
			title: "aide_score ranks misaligned specs below unreviewed ones",
			titleMono: false,
			meta: "aide-score-misaligned-rank",
			taskChips: { column: "In Progress", priority: "p1", type: "bug" },
		});
		expect(drawer.blocks.map((block) => block.heading)).toEqual(["Description", "Acceptance"]);
	});

	it("has no type chip for a note with no type", () => {
		const note: TaskNote = { ...NOTE, column: "todo", task: { state: "readable", slug: NOTE.slug, column: "todo", title: "T", priority: "p2", tags: [], inSession: false } };
		const drawer = buildTaskDrawer({ task: note, linked: false, sessionStart: null });
		expect(drawer.meta).toBe("aide-score-misaligned-rank");
		expect(drawer.taskChips).toEqual({ column: "Todo", priority: "p2", type: null });
	});

	it("adds a Linked block naming the session start when this session linked the task", () => {
		const drawer = buildTaskDrawer({ task: NOTE, linked: true, sessionStart: "Today 14:02" });
		expect(drawer.blocks.at(-1)).toEqual({
			heading: "Linked",
			icon: "eye",
			badge: null,
			type: "kv",
			rows: [{ key: "Session", value: "Today 14:02 (this session)", mono: false }],
		});
	});

	it("says This session when the start is unknown", () => {
		const drawer = buildTaskDrawer({ task: NOTE, linked: true, sessionStart: null });
		expect(drawer.blocks.at(-1)).toMatchObject({ rows: [{ value: "This session" }] });
	});

	it("shows an unreadable note's reason as its one block under the slug, with a column chip only", () => {
		const note: TaskNote = { slug: "broken", column: "done", markdown: "", task: { state: "unreadable", slug: "broken", column: "done", reason: "Invalid YAML", inSession: false } };
		expect(buildTaskDrawer({ task: note, linked: false, sessionStart: null })).toEqual({
			kind: "Task",
			title: "broken",
			titleMono: false,
			meta: "broken",
			taskChips: { column: "Done", priority: null, type: null },
			blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: "Invalid YAML" }],
		});
	});
});
