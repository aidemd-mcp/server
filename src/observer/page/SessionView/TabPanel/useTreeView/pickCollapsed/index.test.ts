import { describe, expect, it } from "vitest";
import type { TreeData } from "@/observer/page/types/index.js";
import pickCollapsed from "./index.js";

describe("pickCollapsed", () => {
	it("starts from the tree's own collapsed folders", () => {
		const tree = { kind: "tree", entries: [], counts: { modules: 0, misaligned: 0, openWork: 0 }, initialCollapsed: ["src", "src/a"] } as TreeData;
		expect([...pickCollapsed({ tree })]).toEqual(["src", "src/a"]);
	});

	it("starts with nothing folded for a project that never reported its folder", () => {
		expect(pickCollapsed({ tree: { kind: "unavailable" } }).size).toBe(0);
	});
});
