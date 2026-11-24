import { describe, expect, it } from "vitest";
import type { ModuleNode, RunningWork, Status } from "@/types/index.js";
import findStepSource from "./index.js";

function work(overrides: Partial<RunningWork>): RunningWork {
	return {
		sessionId: "s1",
		phase: "build",
		agent: "a",
		module: "src/a",
		startedAt: "2026-01-01T09:00:00.000Z",
		elapsedMs: 1,
		buildStep: { reached: 4, total: 9 },
		...overrides,
	};
}

const node: ModuleNode = {
	folder: "src/a",
	parent: ".",
	files: [{ kind: "plan", file: "src/a/plan.aide", folder: "src/a", read: { state: "malformed", error: "x" } }],
};

const statusOf = (running: RunningWork[], tree: ModuleNode[] = [node]) => ({ projectRoot: "/work/app", running, tree }) as unknown as Status;

describe("findStepSource", () => {
	it("is the plan file and the step the followed session's Build has reached", () => {
		expect(findStepSource({ status: statusOf([work({})]), focus: "s1" })).toEqual({ file: "src/a/plan.aide", step: 4 });
	});

	it("reads an absolute module path as the tree's folder", () => {
		expect(findStepSource({ status: statusOf([work({ module: "/work/app/src/a" })]), focus: "s1" })).toEqual({ file: "src/a/plan.aide", step: 4 });
	});

	it("prefers the followed session's work, else the first running", () => {
		const other = work({ sessionId: "s2", buildStep: { reached: 7, total: 9 } });
		expect(findStepSource({ status: statusOf([other, work({})]), focus: "s1" })?.step).toBe(4);
		expect(findStepSource({ status: statusOf([other, work({})]), focus: "s9" })?.step).toBe(7);
	});

	it.each([
		["no status", null],
		["nothing running", statusOf([])],
		["a phase that is not Build", statusOf([work({ phase: "qa", buildStep: undefined })])],
		["a Build that reported no step", statusOf([work({ buildStep: undefined })])],
		["a module with no plan file", statusOf([work({})], [{ ...node, files: [] }])],
	])("is null for %s", (_, status) => {
		expect(findStepSource({ status, focus: "s1" })).toBeNull();
	});
});
