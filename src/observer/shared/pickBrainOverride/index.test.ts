import { describe, expect, it } from "vitest";
import type { ObserverContext } from "../../types/index.js";
import pickBrainOverride from "./index.js";

describe("pickBrainOverride", () => {
	const ctx = { brainOverride: { projectKey: "alpha-aaaaaa", brainPath: "/override" } } as unknown as ObserverContext;

	it("answers the path for the project the override names", () => {
		expect(pickBrainOverride({ ctx, projectKey: "alpha-aaaaaa" })).toBe("/override");
	});

	it("answers undefined for every other project", () => {
		expect(pickBrainOverride({ ctx, projectKey: "beta-bbbbbb" })).toBeUndefined();
	});

	it("answers undefined when no override was given", () => {
		expect(pickBrainOverride({ ctx: {} as unknown as ObserverContext, projectKey: "alpha-aaaaaa" })).toBeUndefined();
	});
});
