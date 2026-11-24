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
	it("is a Kanban task with the title and a meta line of slug, priority, type and column name", () => {
		const drawer = buildTaskDrawer({ task: NOTE, linked: false, sessionStart: null });
		expect(drawer).toMatchObject({
			kind: "Kanban task",
			title: "aide_score ranks misaligned specs below unreviewed ones",
			titleMono: false,
			meta: "aide-score-misaligned-rank · p1 · bug · In Progress",
		});
		expect(drawer.blocks.map((block) => block.heading)).toEqual(["Description", "Acceptance"]);
	});

	it("leaves out a type the note has none of", () => {
		const note: TaskNote = { ...NOTE, column: "todo", task: { state: "readable", slug: NOTE.slug, column: "todo", title: "T", priority: "p2", tags: [], inSession: false } };
		expect(buildTaskDrawer({ task: note, linked: false, sessionStart: null }).meta).toBe("aide-score-misaligned-rank · p2 · Todo");
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

	it("shows an unreadable note's reason as its one block under the slug", () => {
		const note: TaskNote = { slug: "broken", column: "done", markdown: "", task: { state: "unreadable", slug: "broken", column: "done", reason: "Invalid YAML", inSession: false } };
		expect(buildTaskDrawer({ task: note, linked: false, sessionStart: null })).toEqual({
			kind: "Kanban task",
			title: "broken",
			titleMono: false,
			meta: "broken · Done",
			blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: "Invalid YAML" }],
		});
	});
});
