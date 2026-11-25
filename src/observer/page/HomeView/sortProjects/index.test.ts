import { describe, expect, it } from "vitest";
import type { LiveRowModel, ProjectRowModel } from "@/observer/page/types/index.js";
import sortProjects from "./index.js";

function makeProject(name: string, overrides: Partial<ProjectRowModel> = {}): ProjectRowModel {
	return {
		projectKey: `${name}-111111`,
		name,
		root: null,
		kanbanTag: null,
		liveCount: 0,
		waiting: false,
		lastEventAt: null,
		lastActivity: null,
		rows: [],
		openHref: null,
		...overrides,
	};
}

const running = (className: LiveRowModel["badge"]["className"]): ProjectRowModel["status"] => ({
	key: "k",
	project: "p",
	start: "s",
	badge: { word: "w", className, icon: "run" },
	phase: null,
	pipeline: null,
	outside: false,
	module: null,
	agent: null,
	elapsed: null,
	href: "/x",
});

const names = (projects: ProjectRowModel[]): string[] => projects.map((project) => project.name);

describe("sortProjects by activity", () => {
	it("puts waiting projects first, then running ones, then the rest", () => {
		const projects = [
			makeProject("idle", { lastEventAt: "2026-01-03T00:00:00Z" }),
			makeProject("running", { status: running("run"), lastEventAt: "2026-01-01T00:00:00Z" }),
			makeProject("waiting", { waiting: true, lastEventAt: "2026-01-02T00:00:00Z" }),
		];
		expect(names(sortProjects({ projects, order: "activity", custom: [] }))).toEqual(["waiting", "running", "idle"]);
	});

	it("does not count a non-running badge as running", () => {
		const projects = [makeProject("a", { status: running("neutral"), lastEventAt: "2026-01-01T00:00:00Z" }), makeProject("b", { lastEventAt: "2026-01-02T00:00:00Z" })];
		expect(names(sortProjects({ projects, order: "activity", custom: [] }))).toEqual(["b", "a"]);
	});

	it("orders each group newest event first, a project with no event last, and ties by name", () => {
		const projects = [
			makeProject("zed", { lastEventAt: "2026-01-02T00:00:00Z" }),
			makeProject("none"),
			makeProject("old", { lastEventAt: "2026-01-01T00:00:00Z" }),
			makeProject("abe", { lastEventAt: "2026-01-02T00:00:00Z" }),
		];
		expect(names(sortProjects({ projects, order: "activity", custom: [] }))).toEqual(["abe", "zed", "old", "none"]);
	});

	it("ignores the custom list and returns a new array", () => {
		const projects = [makeProject("a"), makeProject("b")];
		const sorted = sortProjects({ projects, order: "activity", custom: ["b-111111", "a-111111"] });
		expect(names(sorted)).toEqual(["a", "b"]);
		expect(sorted).not.toBe(projects);
	});
});

describe("sortProjects in custom order", () => {
	it("follows the saved order of project keys", () => {
		const projects = [makeProject("a"), makeProject("b"), makeProject("c")];
		expect(names(sortProjects({ projects, order: "custom", custom: ["c-111111", "a-111111", "b-111111"] }))).toEqual(["c", "a", "b"]);
	});

	it("puts projects the list does not name after the named ones, by activity, and skips saved keys that no longer exist", () => {
		const projects = [
			makeProject("old", { lastEventAt: "2026-01-01T00:00:00Z" }),
			makeProject("new", { lastEventAt: "2026-01-02T00:00:00Z" }),
			makeProject("saved"),
		];
		expect(names(sortProjects({ projects, order: "custom", custom: ["gone-111111", "saved-111111"] }))).toEqual(["saved", "new", "old"]);
	});

	it("falls back to activity order with an empty list", () => {
		const projects = [makeProject("a", { lastEventAt: "2026-01-01T00:00:00Z" }), makeProject("b", { waiting: true })];
		expect(names(sortProjects({ projects, order: "custom", custom: [] }))).toEqual(["b", "a"]);
	});
});
