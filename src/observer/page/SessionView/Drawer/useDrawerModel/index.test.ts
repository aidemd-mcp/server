import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/fetchFile/index.js", () => ({ default: vi.fn() }));
vi.mock("@/observer/page/api/fetchTask/index.js", () => ({ default: vi.fn() }));

import fetchFile from "@/observer/page/api/fetchFile/index.js";
import fetchTask from "@/observer/page/api/fetchTask/index.js";
import type { DrawerContext, DrawerItem, DrawerModel, Fetched } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import useDrawerModel from "./index.js";

const file = fetchFile as ReturnType<typeof vi.fn>;
const task = fetchTask as ReturnType<typeof vi.fn>;

/** Mounts `useDrawerModel` and exposes the latest value it returned. */
function mount({ item, context }: { item: DrawerItem; context: DrawerContext }) {
	const latest: { model: Fetched<DrawerModel> | null } = { model: null };
	function Probe() {
		latest.model = useDrawerModel({ item, context });
		return createElement(Text, null, latest.model.state);
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get model(): Fetched<DrawerModel> {
			if (latest.model === null) throw new Error("hook did not run");
			return latest.model;
		},
	};
}

const WITH_TREE = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }) });

beforeEach(() => {
	vi.clearAllMocks();
	file.mockImplementation(({ path }: { path: string }) => Promise.resolve({ ok: true, data: { path, text: path.endsWith("plan.aide") ? "### 1. First\n\n- [ ] First\n" : "" } }));
});

describe("useDrawerModel", () => {
	it("reads a module's listed files with the link's token and project, loading until they arrive, then builds the drawer", async () => {
		const probe = mount({ item: { kind: "module", folder: "src/tools/score" }, context: WITH_TREE });
		expect(probe.model).toEqual({ state: "loading" });

		await probe.settle();
		expect(file).toHaveBeenCalledTimes(3);
		for (const path of ["src/tools/score/.aide", "src/tools/score/plan.aide", "src/tools/score/todo.aide"]) {
			expect(file).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", path });
		}
		expect(probe.model.state).toBe("ready");
		expect(probe.model).toMatchObject({ data: { kind: "Module", title: "src/tools/score" } });
		probe.view.unmount();
	});

	it("opens an AIDE file as its module", async () => {
		const probe = mount({ item: { kind: "file", path: "src/tools/score/todo.aide" }, context: WITH_TREE });
		await probe.settle();
		expect(probe.model).toMatchObject({ state: "ready", data: { kind: "Module · todo" } });
		probe.view.unmount();
	});

	it("reads a task through fetchTask", async () => {
		task.mockResolvedValue({
			ok: true,
			data: { slug: "fix-it", column: "todo", markdown: "# Fix it\n", task: { state: "readable", slug: "fix-it", column: "todo", title: "Fix it", priority: "p2", tags: [], inSession: false } },
		});
		const probe = mount({ item: { kind: "task", slug: "fix-it" }, context: WITH_TREE });
		await probe.settle();
		expect(task).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", slug: "fix-it" });
		expect(probe.model).toMatchObject({ state: "ready", data: { kind: "Kanban task", title: "Fix it" } });
		probe.view.unmount();
	});

	it("shows the observer's message as the drawer's one block when a read fails, not an error state", async () => {
		task.mockResolvedValue({ ok: false, status: 404, message: "Task not found" });
		const probe = mount({ item: { kind: "task", slug: "gone" }, context: WITH_TREE });
		await probe.settle();
		expect(probe.model).toEqual({
			state: "ready",
			data: { kind: "Kanban task", title: "gone", titleMono: false, meta: null, blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: "Task not found" }] },
		});
		probe.view.unmount();
	});

	it("is ready at once, fetching nothing, for an event with nothing to read", () => {
		const events = [makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "release", version: "1.0.0" })];
		const probe = mount({ item: { kind: "event", sessionId: "s1", seq: 1 }, context: makeContext({ events }) });
		expect(probe.model).toMatchObject({ state: "ready", data: { kind: "Release" } });
		expect(file).not.toHaveBeenCalled();
		probe.view.unmount();
	});

	it("shows a QA verdict at once and adds its todo issues when the file arrives", async () => {
		file.mockResolvedValue({ ok: true, data: { path: "src/tools/score/todo.aide", text: "- [ ] a.ts:1 — broken\n" } });
		const events = [makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "qa_verdict", module: "src/tools/score", verdict: "issues", open: 1 })];
		const probe = mount({ item: { kind: "event", sessionId: "s1", seq: 1 }, context: makeContext({ status: makeStatus({ tree: [SCORE_NODE] }), events }) });

		expect(probe.model).toMatchObject({ state: "ready", data: { kind: "QA verdict", blocks: [] } });
		await probe.settle();
		expect(file).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", path: "src/tools/score/todo.aide" });
		expect(probe.model).toMatchObject({ state: "ready", data: { blocks: [{ heading: "Todo" }] } });
		probe.view.unmount();
	});

	it("is ready with an empty module for one the tree does not list, reading nothing", () => {
		const probe = mount({ item: { kind: "module", folder: "src/none" }, context: WITH_TREE });
		expect(probe.model).toMatchObject({ state: "ready", data: { kind: "Module", title: "src/none", blocks: [] } });
		expect(file).not.toHaveBeenCalled();
		probe.view.unmount();
	});
});
