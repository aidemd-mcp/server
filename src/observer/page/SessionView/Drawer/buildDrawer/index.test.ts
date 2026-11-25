import { describe, expect, it } from "vitest";
import type { DrawerSource, TaskNote } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import buildDrawer from "./index.js";

/** An instant an hour before the fixtures clock. */
const EARLIER = "2026-11-23T14:00:00.000Z";
const NONE: DrawerSource = { type: "none" };
const WITH_TREE = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }) });
const PLAN = "### 1. First\n\n- [ ] First\n";

describe("buildDrawer", () => {
	it("builds a module from its fetched texts", () => {
		const source: DrawerSource = { type: "files", texts: { plan: PLAN } };
		const drawer = buildDrawer({ item: { kind: "module", folder: "src/tools/score" }, source, context: WITH_TREE });
		expect(drawer).toMatchObject({ kind: "Module", title: "src/tools/score" });
		expect(drawer.sections).toMatchObject({ open: "plan", list: [{ kind: "plan", label: "plan.aide" }] });
		expect(drawer.sections?.list[0]?.blocks.map((block) => block.heading)).toEqual(["Body"]);
	});

	it("builds an opened todo file as its module with the todo section open", () => {
		const source: DrawerSource = { type: "files", texts: { plan: PLAN, todo: "- [ ] a — b\n" } };
		const drawer = buildDrawer({ item: { kind: "file", path: "src/tools/score/todo.aide" }, source, context: WITH_TREE });
		expect(drawer.kind).toBe("Module");
		expect(drawer.sections?.open).toBe("todo");
		expect(drawer.sections?.list.map((section) => section.kind)).toEqual(["plan", "todo"]);
	});

	it("builds the root session file as the root module with its session section open", () => {
		const root = { folder: ".", parent: null, files: [{ ...SCORE_NODE.files[0]!, folder: ".", file: ".aide/intent.aide" }] };
		const context = makeContext({ status: makeStatus({ tree: [root] }) });
		const source: DrawerSource = { type: "files", texts: { session: "---\nstatus: active\n---\n\n## Intent\n\nShip it.\n" } };
		const drawer = buildDrawer({ item: { kind: "file", path: ".aide/session.aide" }, source, context });
		expect(drawer.kind).toBe("Module");
		expect(drawer.sections).toMatchObject({ open: "session", list: [{ kind: "session", path: ".aide/session.aide" }] });
	});

	it("builds a task as a Task with its slug as meta and its chips", () => {
		const note: TaskNote = {
			slug: "fix-it",
			column: "todo",
			markdown: "# Fix it\n\nWords.\n",
			task: { state: "readable", slug: "fix-it", column: "todo", title: "Fix it", priority: "p2", type: "bug", tags: [], inSession: false },
		};
		expect(buildDrawer({ item: { kind: "task", slug: "fix-it" }, source: { type: "task", note }, context: WITH_TREE })).toMatchObject({
			kind: "Task",
			title: "Fix it",
			meta: "fix-it",
			taskChips: { column: "Todo", priority: "p2", type: "bug" },
		});
	});

	it("builds any other file as plain text", () => {
		const source: DrawerSource = { type: "files", texts: { file: "export {};" } };
		expect(buildDrawer({ item: { kind: "file", path: "src/a/index.ts" }, source, context: WITH_TREE })).toMatchObject({
			kind: "File",
			title: "src/a/index.ts",
			blocks: [{ type: "pre", text: "export {};" }],
		});
	});

	describe("a task", () => {
		const note: TaskNote = {
			slug: "fix-it",
			column: "todo",
			markdown: "# Fix it\n\nWords.\n",
			task: { state: "readable", slug: "fix-it", column: "todo", title: "Fix it", priority: "p2", tags: [], inSession: false },
		};
		const source: DrawerSource = { type: "task", note };

		it("is not linked unless the session record or a task event of the followed session names it", () => {
			expect(buildDrawer({ item: { kind: "task", slug: "fix-it" }, source, context: WITH_TREE }).blocks.map((block) => block.heading)).toEqual(["Description"]);
		});

		it("is linked by a task event of the followed session, with the session's start worded as `<day> HH:MM`", () => {
			const events = [
				makeEvent({ seq: 1, ts: EARLIER, kind: "session_started" }),
				makeEvent({ seq: 2, ts: EARLIER, kind: "task", slug: "fix-it", action: "picked" }),
			];
			const drawer = buildDrawer({ item: { kind: "task", slug: "fix-it" }, source, context: makeContext({ events }) });
			expect(drawer.blocks.at(-1)).toMatchObject({ heading: "Linked", rows: [{ key: "Session", value: expect.stringMatching(/^.+ \d\d:\d\d \(this session\)$/) }] });
		});

		it("is linked when the observer says the session record names it", () => {
			const inSession: DrawerSource = { type: "task", note: { ...note, task: { ...note.task, state: "readable", slug: "fix-it", column: "todo", title: "Fix it", priority: "p2", tags: [], inSession: true } } };
			expect(buildDrawer({ item: { kind: "task", slug: "fix-it" }, source: inSession, context: WITH_TREE }).blocks.at(-1)).toMatchObject({ heading: "Linked" });
		});
	});

	it("builds an event from the held events", () => {
		const events = [makeEvent({ seq: 3, ts: "2026-11-23T14:00:00.000Z", kind: "release", version: "1.2.3" })];
		expect(buildDrawer({ item: { kind: "event", sessionId: "s1", seq: 3 }, source: NONE, context: makeContext({ events }) })).toMatchObject({ kind: "Release", title: "1.2.3" });
	});

	it("gives a QA verdict its module's todo issues once the todo is fetched", () => {
		const events = [makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "qa_verdict", module: "src/tools/score", verdict: "issues", open: 1 })];
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }), events });
		const source: DrawerSource = { type: "files", texts: { todo: "- [ ] a.ts:1 — broken\n" } };
		expect(buildDrawer({ item: { kind: "event", sessionId: "s1", seq: 1 }, source: NONE, context }).blocks).toEqual([]);
		expect(buildDrawer({ item: { kind: "event", sessionId: "s1", seq: 1 }, source, context }).blocks).toHaveLength(1);
	});

	it("tells in the drawer that an event is no longer held, and likewise one the history never opens as an event", () => {
		const events = [makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "task", slug: "s", action: "picked" })];
		const context = makeContext({ events });
		for (const seq of [1, 99]) {
			expect(buildDrawer({ item: { kind: "event", sessionId: "s1", seq }, source: NONE, context })).toMatchObject({
				kind: "Event",
				blocks: [{ type: "pre", text: "This event is no longer held by the viewer." }],
			});
		}
	});
});
