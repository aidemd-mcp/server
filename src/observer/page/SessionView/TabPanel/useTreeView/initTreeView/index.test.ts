import { describe, expect, it } from "vitest";
import type { TreeData } from "@/observer/page/types/index.js";
import initTreeView from "./index.js";

describe("initTreeView", () => {
	it("starts with an empty filter, both toggles off and the tree's own folded folders", () => {
		const tree = { kind: "tree", entries: [], counts: { modules: 0, misaligned: 0, openWork: 0 }, initialCollapsed: ["src"] } as TreeData;
		const view = initTreeView({ tree });
		expect(view).toEqual({ query: "", onlyOpen: false, onlyMisaligned: false, collapsed: new Set(["src"]) });
	});
});
