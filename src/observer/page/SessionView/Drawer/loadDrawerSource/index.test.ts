import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/fetchFile/index.js", () => ({ default: vi.fn() }));
vi.mock("@/observer/page/api/fetchTask/index.js", () => ({ default: vi.fn() }));

import fetchFile from "@/observer/page/api/fetchFile/index.js";
import fetchTask from "@/observer/page/api/fetchTask/index.js";
import loadDrawerSource from "./index.js";

const file = fetchFile as ReturnType<typeof vi.fn>;
const task = fetchTask as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadDrawerSource", () => {
	it("answers a plan that needs nothing without calling the observer", async () => {
		expect(await loadDrawerSource({ plan: { type: "none" }, token: "t", projectKey: "k" })).toEqual({ ok: true, data: { type: "none" } });
		expect(file).not.toHaveBeenCalled();
		expect(task).not.toHaveBeenCalled();
	});

	it("reads every file of a module with the link's token and files the texts by role", async () => {
		file.mockImplementation(({ path }: { path: string }) => Promise.resolve({ ok: true, data: { path, text: `text of ${path}` } }));

		const result = await loadDrawerSource({
			plan: {
				type: "files",
				files: [
					{ role: "spec", path: "src/a/.aide" },
					{ role: "plan", path: "src/a/plan.aide" },
				],
			},
			token: "tok",
			projectKey: "proj",
		});

		expect(file).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", path: "src/a/.aide" });
		expect(file).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", path: "src/a/plan.aide" });
		expect(result).toEqual({ ok: true, data: { type: "files", texts: { spec: "text of src/a/.aide", plan: "text of src/a/plan.aide" } } });
	});

	it("returns the observer's failure when any file cannot be read", async () => {
		file.mockImplementation(({ path }: { path: string }) =>
			Promise.resolve(path === "b" ? { ok: false, status: 404, message: "File not found" } : { ok: true, data: { path, text: "x" } }),
		);

		const result = await loadDrawerSource({
			plan: { type: "files", files: [{ role: "spec", path: "a" }, { role: "plan", path: "b" }] },
			token: "t",
			projectKey: "k",
		});

		expect(result).toEqual({ ok: false, status: 404, message: "File not found" });
	});

	it("reads a task through fetchTask and wraps its note", async () => {
		const note = { slug: "s", column: "todo", markdown: "# S", task: { state: "unreadable", slug: "s", column: "todo", reason: "x", inSession: false } };
		task.mockResolvedValue({ ok: true, data: note });

		expect(await loadDrawerSource({ plan: { type: "task", slug: "s" }, token: "t", projectKey: "k" })).toEqual({ ok: true, data: { type: "task", note } });
		expect(task).toHaveBeenCalledWith({ token: "t", projectKey: "k", slug: "s" });
	});

	it("passes a task failure through", async () => {
		const failure = { ok: false, status: 404, message: "Task not found" };
		task.mockResolvedValue(failure);

		expect(await loadDrawerSource({ plan: { type: "task", slug: "s" }, token: "t", projectKey: "k" })).toBe(failure);
	});
});
