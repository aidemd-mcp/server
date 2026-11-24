import { describe, expect, it } from "vitest";
import type { ProjectRowModel } from "@/observer/page/types/index.js";
import compareProjects from "./index.js";

function project(name: string, lastEventAt: string | null): ProjectRowModel {
	return { projectKey: name, name, root: null, kanbanTag: null, liveCount: 0, waiting: false, lastEventAt, lastActivity: null, rows: [], openHref: null };
}

describe("compareProjects", () => {
	it("puts the newest event first, a project with no event last, and ties by name", () => {
		const sorted = [project("empty", null), project("b", "2026-01-01T09:00:00.000Z"), project("a", "2026-01-01T09:00:00.000Z"), project("busy", "2026-01-01T10:00:00.000Z")].sort(compareProjects);
		expect(sorted.map((entry) => entry.name)).toEqual(["busy", "a", "b", "empty"]);
	});
});
