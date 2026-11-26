import { describe, expect, it } from "vitest";
import type { ObserverContext } from "../../types/index.js";
import pickKanbanOverride from "./index.js";

describe("pickKanbanOverride", () => {
	const ctx = { kanbanOverride: { projectKey: "alpha-aaaaaa", kanbanPath: "/override" } } as unknown as ObserverContext;

	it("answers the folder for the project the override names", () => {
		expect(pickKanbanOverride({ ctx, projectKey: "alpha-aaaaaa" })).toBe("/override");
	});

	it("answers undefined for every other project", () => {
		expect(pickKanbanOverride({ ctx, projectKey: "beta-bbbbbb" })).toBeUndefined();
	});

	it("answers undefined when no override was given", () => {
		expect(pickKanbanOverride({ ctx: {} as unknown as ObserverContext, projectKey: "alpha-aaaaaa" })).toBeUndefined();
	});
});
