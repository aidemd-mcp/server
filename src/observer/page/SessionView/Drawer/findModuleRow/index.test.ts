import { describe, expect, it } from "vitest";
import type { ModuleNode, Status } from "@/types/index.js";
import type { DrawerContext } from "@/observer/page/types/index.js";
import findModuleRow from "./index.js";

const TREE: ModuleNode[] = [
	{
		folder: "src/a",
		parent: null,
		files: [{ kind: "plan", file: "src/a/plan.aide", folder: "src/a", read: { state: "present", status: "approved", awaitingApproval: false, progress: { done: 1, total: 3, open: 2 }, steps: { done: 1, total: 3 } } }],
	},
];

function contextOf(status: Pick<Status, "tree"> | null): DrawerContext {
	return { token: "t", projectKey: "k", status: status as Status | null, events: [], sessions: [], focus: "s1", now: new Date("2026-11-23T12:00:00Z") };
}

describe("findModuleRow", () => {
	it("finds the row of a listed folder", () => {
		expect(findModuleRow({ folder: "src/a", context: contextOf({ tree: TREE }) })?.plan?.file).toBe("src/a/plan.aide");
	});

	it("is null for a folder the tree does not list", () => {
		expect(findModuleRow({ folder: "src/b", context: contextOf({ tree: TREE }) })).toBeNull();
	});

	it("is null without a status", () => {
		expect(findModuleRow({ folder: "src/a", context: contextOf(null) })).toBeNull();
	});
});
