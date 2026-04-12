import { describe, it, expect } from "vitest";
import flattenTree from "./index.js";
import type { AideFile, TreeNode } from "@/types/index.js";

function makeFileNode(relativePath: string): TreeNode {
	const file: AideFile = { path: `/root/${relativePath}`, relativePath, type: "intent", summary: "" };
	return { kind: "file", file };
}

function makeDirNode(path: string, children: TreeNode[]): TreeNode {
	return { kind: "dir", path, children };
}

describe("flattenTree", () => {
	it("returns empty array for empty input", () => {
		expect(flattenTree([])).toEqual([]);
	});

	it("handles a single file node at depth 0", () => {
		const nodes = [makeFileNode(".aide")];
		const flat = flattenTree(nodes);
		expect(flat).toHaveLength(1);
		expect(flat[0].depth).toBe(0);
		expect(flat[0].node.kind).toBe("file");
	});

	it("flattens a dir with children: dir first, then children at depth+1", () => {
		const nodes = [
			makeDirNode("src/tools/init", [
				makeFileNode("src/tools/init/intent.aide"),
				makeFileNode("src/tools/init/research.aide"),
			]),
		];
		const flat = flattenTree(nodes);
		expect(flat).toHaveLength(3);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/tools/init" } });
		expect(flat[1]).toMatchObject({ depth: 1, node: { kind: "file" } });
		expect(flat[2]).toMatchObject({ depth: 1, node: { kind: "file" } });
	});

	it("handles nested dirs with correct depths", () => {
		const nodes = [
			makeDirNode(".", [makeFileNode(".aide")]),
			makeDirNode("src/cli", [makeFileNode("src/cli/.aide")]),
		];
		const flat = flattenTree(nodes);
		expect(flat).toHaveLength(4);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "." } });
		expect(flat[1]).toMatchObject({ depth: 1, node: { kind: "file" } });
		expect(flat[2]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/cli" } });
		expect(flat[3]).toMatchObject({ depth: 1, node: { kind: "file" } });
	});

	it("handles single-file tree (single dir with one file)", () => {
		const nodes = [makeDirNode(".", [makeFileNode(".aide")])];
		const flat = flattenTree(nodes);
		expect(flat).toHaveLength(2);
		expect(flat[0].node.kind).toBe("dir");
		expect(flat[1].node.kind).toBe("file");
	});
});
