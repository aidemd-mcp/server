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

	it("empty expandedDirs produces only dir nodes — no file children emitted", () => {
		const nodes = [
			makeDirNode("src/tools/init", [
				makeFileNode("src/tools/init/intent.aide"),
				makeFileNode("src/tools/init/research.aide"),
			]),
		];
		const flat = flattenTree(nodes, new Set());
		// Only the dir node should appear, no children.
		expect(flat).toHaveLength(1);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/tools/init" } });
	});

	it("expanding a dir by adding its path to the Set includes its file children in the output", () => {
		const nodes = [
			makeDirNode("src/tools/init", [
				makeFileNode("src/tools/init/intent.aide"),
				makeFileNode("src/tools/init/research.aide"),
			]),
		];
		const flat = flattenTree(nodes, new Set(["src/tools/init"]));
		expect(flat).toHaveLength(3);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/tools/init" } });
		expect(flat[1]).toMatchObject({ depth: 1, node: { kind: "file" } });
		expect(flat[2]).toMatchObject({ depth: 1, node: { kind: "file" } });
	});

	it("expanding one dir does not include children from other dirs", () => {
		const nodes = [
			makeDirNode(".", [makeFileNode(".aide")]),
			makeDirNode("src/cli", [makeFileNode("src/cli/.aide")]),
		];
		// Only expand "." — src/cli children should stay hidden.
		const flat = flattenTree(nodes, new Set(["."]) );
		expect(flat).toHaveLength(3);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "." } });
		expect(flat[1]).toMatchObject({ depth: 1, node: { kind: "file" } });
		expect(flat[2]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/cli" } });
		// src/cli's child should NOT appear.
		expect(flat.find((fn) => fn.node.kind === "file" && fn.node.file.relativePath === "src/cli/.aide")).toBeUndefined();
	});

	it("backward compat — calling with default second arg (empty Set) collapses everything", () => {
		const nodes = [
			makeDirNode(".", [makeFileNode(".aide")]),
			makeDirNode("src/cli", [makeFileNode("src/cli/.aide")]),
		];
		const flat = flattenTree(nodes);
		// Only dir nodes, no file children.
		expect(flat).toHaveLength(2);
		expect(flat.every((fn) => fn.node.kind === "dir")).toBe(true);
	});

	it("handles nested dirs with correct depths when expanded", () => {
		const nodes = [
			makeDirNode(".", [makeFileNode(".aide")]),
			makeDirNode("src/cli", [makeFileNode("src/cli/.aide")]),
		];
		const flat = flattenTree(nodes, new Set([".", "src/cli"]));
		expect(flat).toHaveLength(4);
		expect(flat[0]).toMatchObject({ depth: 0, node: { kind: "dir", path: "." } });
		expect(flat[1]).toMatchObject({ depth: 1, node: { kind: "file" } });
		expect(flat[2]).toMatchObject({ depth: 0, node: { kind: "dir", path: "src/cli" } });
		expect(flat[3]).toMatchObject({ depth: 1, node: { kind: "file" } });
	});

	it("handles single-file tree (single dir with one file) — no children without expansion", () => {
		const nodes = [makeDirNode(".", [makeFileNode(".aide")])];
		const flat = flattenTree(nodes);
		expect(flat).toHaveLength(1);
		expect(flat[0].node.kind).toBe("dir");
	});

	it("handles single-file tree (single dir with one file) — child visible when expanded", () => {
		const nodes = [makeDirNode(".", [makeFileNode(".aide")])];
		const flat = flattenTree(nodes, new Set(["."]) );
		expect(flat).toHaveLength(2);
		expect(flat[0].node.kind).toBe("dir");
		expect(flat[1].node.kind).toBe("file");
	});
});
