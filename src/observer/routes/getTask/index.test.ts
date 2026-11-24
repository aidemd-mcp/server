import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";

vi.mock("@/service/observer/kanban/task/read/index.js", () => ({ default: vi.fn() }));

import readTask from "@/service/observer/kanban/task/read/index.js";
import getTask from "./index.js";

const mockRead = readTask as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";
const OTHER_KEY = "beta-bbbbbb";
const NO_ROOT_KEY = "gamma-cccccc";

const STARTED = {
	v: 1,
	ts: "2026-01-01T00:00:00.000Z",
	sessionId: "a",
	seq: 1,
	pid: 1,
	kind: "session_started",
	projectRoot: "/project",
	brainPath: "/reported/brain",
	kanbanTag: "tag",
};

const HELD: Record<string, unknown[]> = {
	[KEY]: [{ projectKey: KEY, sessionId: "a", events: [STARTED] }],
	[OTHER_KEY]: [{ projectKey: OTHER_KEY, sessionId: "b", events: [{ ...STARTED, sessionId: "b", projectRoot: "/other", brainPath: "/other/brain" }] }],
	[NO_ROOT_KEY]: [{ projectKey: NO_ROOT_KEY, sessionId: "g", events: [{ ...STARTED, sessionId: "g", projectRoot: undefined }] }],
};

async function call({ project = KEY, overrideFor = KEY }: { project?: string; overrideFor?: string } = {}): Promise<{
	status: number;
	body: Record<string, unknown>;
}> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const ctx = {
		brainOverride: { projectKey: overrideFor, brainPath: "/override" },
		store: { sessions: ({ projectKey }: { projectKey?: string } = {}) => (projectKey === undefined ? [] : (HELD[projectKey] ?? [])) },
	} as unknown as ObserverContext;
	await getTask({
		req: {} as RouteInput["req"],
		res,
		url: new URL("http://127.0.0.1/"),
		params: { project, slug: "my-task" },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("getTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("reads with the project's reported location, its reported root, the override and the slug", async () => {
		mockRead.mockResolvedValue({ state: "not-found", slug: "my-task" });

		await call();

		expect(mockRead).toHaveBeenCalledWith({
			reported: { brainPath: "/reported/brain", kanbanTag: "tag" },
			brainOverride: "/override",
			projectRoot: "/project",
			slug: "my-task",
		});
	});

	it("applies the --brain override only to the project it names", async () => {
		mockRead.mockResolvedValue({ state: "not-found", slug: "my-task" });

		await call({ project: OTHER_KEY, overrideFor: KEY });

		expect(mockRead).toHaveBeenCalledWith({
			reported: { brainPath: "/other/brain", kanbanTag: "tag" },
			brainOverride: undefined,
			projectRoot: "/other",
			slug: "my-task",
		});
	});

	it("answers 200 with slug, column, markdown and task when found", async () => {
		mockRead.mockResolvedValue({
			state: "found",
			slug: "my-task",
			column: "todo",
			markdown: "# T",
			task: { state: "readable" },
		});

		expect(await call()).toEqual({
			status: 200,
			body: { data: { slug: "my-task", column: "todo", markdown: "# T", task: { state: "readable" } } },
		});
	});

	it("answers 404 with the reason and the hint when the board is unavailable", async () => {
		mockRead.mockResolvedValue({ state: "unavailable", reason: "no-brain-path", detail: "d", hint: "do this" });

		expect(await call()).toEqual({ status: 404, body: { error: { message: "no-brain-path", details: "do this" } } });
	});

	it("answers 404 naming the slug when it is not on the board", async () => {
		mockRead.mockResolvedValue({ state: "not-found", slug: "my-task" });

		const { status, body } = await call();

		expect(status).toBe(404);
		expect((body.error as { message: string }).message).toContain("my-task");
	});

	it("answers 403 with the detail when kanban refuses the slug", async () => {
		mockRead.mockResolvedValue({ state: "refused", slug: "my-task", detail: "cannot be read: EACCES" });

		const { status, body } = await call();

		expect(status).toBe(403);
		expect((body.error as { details: string }).details).toBe("cannot be read: EACCES");
	});

	it("answers 404 with the reason and reads nothing for a project that reported no root", async () => {
		const { status, body } = await call({ project: NO_ROOT_KEY });

		expect(status).toBe(404);
		expect((body.error as { message: string }).message).toContain("reported its project root");
		expect(mockRead).not.toHaveBeenCalled();
	});

	it("answers 404 No such project for an unheld or invalid key and reads nothing", async () => {
		for (const project of ["delta-dddddd", "../x"]) {
			const { status, body } = await call({ project });
			expect(status).toBe(404);
			expect(body).toEqual({ error: { message: "No such project." } });
		}
		expect(mockRead).not.toHaveBeenCalled();
	});
});
