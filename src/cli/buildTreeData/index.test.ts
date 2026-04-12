import { describe, it, expect } from "vitest";
import buildTreeData from "./index.js";
import type { AideFile } from "@/types/index.js";

function makeFile(relativePath: string, type: AideFile["type"] = "intent"): AideFile {
	return { path: `/root/${relativePath}`, relativePath, type, summary: "" };
}

describe("buildTreeData", () => {
	it("groups files by directory", () => {
		const files = [
			makeFile("src/tools/discover/.aide"),
			makeFile("src/tools/init/intent.aide"),
		];
		const nodes = buildTreeData(files);
		expect(nodes).toHaveLength(2);
		const dirs = nodes.map((n) => (n.kind === "dir" ? n.path : null));
		expect(dirs).toContain("src/tools/discover");
		expect(dirs).toContain("src/tools/init");
	});

	it("places root-level files under '.' directory", () => {
		const files = [makeFile(".aide")];
		const nodes = buildTreeData(files);
		expect(nodes).toHaveLength(1);
		expect(nodes[0].kind).toBe("dir");
		if (nodes[0].kind === "dir") {
			expect(nodes[0].path).toBe(".");
			expect(nodes[0].children).toHaveLength(1);
		}
	});

	it("sorts directories alphabetically with '.' first", () => {
		const files = [
			makeFile("src/tools/init/.aide"),
			makeFile(".aide"),
			makeFile("src/cli/.aide"),
		];
		const nodes = buildTreeData(files);
		expect(nodes[0].kind === "dir" && nodes[0].path).toBe(".");
		const paths = nodes.map((n) => (n.kind === "dir" ? n.path : ""));
		expect(paths[1]).toBe("src/cli");
		expect(paths[2]).toBe("src/tools/init");
	});

	it("sorts files within a directory by type priority: intent > research > plan > todo", () => {
		const files = [
			makeFile("src/tools/init/todo.aide", "todo"),
			makeFile("src/tools/init/plan.aide", "plan"),
			makeFile("src/tools/init/research.aide", "research"),
			makeFile("src/tools/init/intent.aide", "intent"),
		];
		const nodes = buildTreeData(files);
		expect(nodes).toHaveLength(1);
		const dirNode = nodes[0];
		if (dirNode.kind !== "dir") throw new Error("expected dir");
		const types = dirNode.children.map((c) => (c.kind === "file" ? c.file.type : null));
		expect(types).toEqual(["intent", "research", "plan", "todo"]);
	});

	it("handles multiple files in root directory", () => {
		const files = [
			makeFile(".aide", "intent"),
			makeFile("plan.aide", "plan"),
		];
		const nodes = buildTreeData(files);
		expect(nodes).toHaveLength(1);
		const dirNode = nodes[0];
		if (dirNode.kind !== "dir") throw new Error("expected dir");
		expect(dirNode.children).toHaveLength(2);
		expect(dirNode.children[0]).toMatchObject({ kind: "file", file: { type: "intent" } });
		expect(dirNode.children[1]).toMatchObject({ kind: "file", file: { type: "plan" } });
	});

	it("returns empty array for empty input", () => {
		expect(buildTreeData([])).toEqual([]);
	});

	it("handles files with the same directory across different paths", () => {
		const files = [
			makeFile("src/tools/init/intent.aide", "intent"),
			makeFile("src/tools/init/research.aide", "research"),
		];
		const nodes = buildTreeData(files);
		expect(nodes).toHaveLength(1);
		const dirNode = nodes[0];
		if (dirNode.kind !== "dir") throw new Error("expected dir");
		expect(dirNode.children).toHaveLength(2);
	});
});
