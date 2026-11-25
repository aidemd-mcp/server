import { describe, expect, it } from "vitest";
import type { TreeData, TreeEntry } from "@/observer/page/types/index.js";
import pickParents from "./index.js";

function makeEntry(folder: string, hasChildren: boolean): TreeEntry {
	return {
		folder,
		path: folder,
		depth: 1,
		description: null,
		alignment: null,
		chips: [],
		current: null,
		misaligned: false,
		hasChildren,
		ancestors: [],
		descendants: 0,
		openWork: false,
	};
}

describe("pickParents", () => {
	it("lists every folder with children, the root included", () => {
		const tree: TreeData = {
			kind: "tree",
			entries: [makeEntry(".", true), makeEntry("src", true), makeEntry("src/a", false), makeEntry("lib", true)],
			counts: { modules: 4, misaligned: 0, openWork: 0 },
			initialCollapsed: [],
		};
		expect(pickParents({ tree })).toEqual([".", "src", "lib"]);
	});
});
