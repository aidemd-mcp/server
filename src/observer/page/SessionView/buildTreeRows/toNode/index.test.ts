import { describe, expect, it } from "vitest";
import type { TreeEntry } from "@/observer/page/types/index.js";
import toNode from "./index.js";

function entry(overrides: Partial<TreeEntry> = {}): TreeEntry {
	return {
		folder: "src/tools",
		path: "src/tools",
		depth: 2,
		description: "Tools",
		alignment: "aligned",
		chips: [],
		current: "Last worked on",
		misaligned: false,
		hasChildren: true,
		ancestors: [".", "src"],
		descendants: 6,
		openWork: true,
		...overrides,
	};
}

const NONE: ReadonlySet<string> = new Set();

describe("toNode", () => {
	it("carries the entry's facts and starts open with nothing hidden", () => {
		expect(toNode({ entry: entry(), flat: false, collapsed: NONE })).toEqual({
			folder: "src/tools",
			path: "src/tools",
			depth: 2,
			description: "Tools",
			alignment: "aligned",
			chips: [],
			current: "Last worked on",
			misaligned: false,
			hasChildren: true,
			collapsed: false,
			hiddenCount: 0,
		});
	});

	it("closes a folder in the collapsed set and says how many modules it hides", () => {
		const node = toNode({ entry: entry(), flat: false, collapsed: new Set(["src/tools"]) });
		expect(node.collapsed).toBe(true);
		expect(node.hiddenCount).toBe(6);
	});

	it("leaves a folder open when only another folder is collapsed", () => {
		expect(toNode({ entry: entry(), flat: false, collapsed: new Set(["src"]) })).toMatchObject({ collapsed: false, hiddenCount: 0 });
	});

	it("never collapses a leaf", () => {
		const node = toNode({ entry: entry({ hasChildren: false, descendants: 0 }), flat: false, collapsed: new Set(["src/tools"]) });
		expect(node).toMatchObject({ hasChildren: false, collapsed: false, hiddenCount: 0 });
	});

	it("stands a filtered node alone at depth 0 as a leaf, whatever the collapsed set holds", () => {
		const node = toNode({ entry: entry(), flat: true, collapsed: new Set(["src/tools"]) });
		expect(node).toMatchObject({ depth: 0, hasChildren: false, collapsed: false, hiddenCount: 0, path: "src/tools" });
	});
});
