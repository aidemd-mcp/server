import { describe, expect, it } from "vitest";
import type { ProjectRowModel } from "@/observer/page/types/index.js";
import filterProjects from "./index.js";

function project(name: string, root: string | null): ProjectRowModel {
	return { projectKey: name, name, root, kanbanTag: null, liveCount: 0, waiting: false, lastEventAt: null, lastActivity: null, rows: [], openHref: null };
}

const PROJECTS = [project("lead-crawler", "~/code/lead-crawler"), project("docs-portal", "~/work/docs-portal"), project("orphan", null)];

describe("filterProjects", () => {
	it("keeps every project for an empty or blank query", () => {
		expect(filterProjects({ projects: PROJECTS, query: "" })).toEqual(PROJECTS);
		expect(filterProjects({ projects: PROJECTS, query: "   " })).toEqual(PROJECTS);
	});

	it("matches the name, ignoring case", () => {
		expect(filterProjects({ projects: PROJECTS, query: " Crawler" }).map((entry) => entry.name)).toEqual(["lead-crawler"]);
	});

	it("matches the root and skips a project with none", () => {
		expect(filterProjects({ projects: PROJECTS, query: "~/work" }).map((entry) => entry.name)).toEqual(["docs-portal"]);
		expect(filterProjects({ projects: PROJECTS, query: "nothing" })).toEqual([]);
	});
});
