import { describe, it, expect } from "vitest";
import findPrimaryIntent from "./index.js";
import type { AideFile, TreeNode } from "@/types/index.js";

function makeFileNode(relativePath: string, type: AideFile["type"] = "intent"): TreeNode {
	return {
		kind: "file",
		file: { path: `/root/${relativePath}`, relativePath, type, summary: "" },
	};
}

function makeDirNode(path: string, children: TreeNode[]): TreeNode {
	return { kind: "dir", path, children };
}

describe("findPrimaryIntent", () => {
	it("returns the intent-type child for a dir with a single intent child", () => {
		const dir = makeDirNode("src/cli", [makeFileNode("src/cli/.aide", "intent")]);
		const result = findPrimaryIntent(dir);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("intent");
		expect(result?.relativePath).toBe("src/cli/.aide");
	});

	it("returns the first intent-type child when dir has multiple children of mixed types", () => {
		const dir = makeDirNode("src/tools/init", [
			makeFileNode("src/tools/init/research.aide", "research"),
			makeFileNode("src/tools/init/intent.aide", "intent"),
			makeFileNode("src/tools/init/plan.aide", "plan"),
		]);
		const result = findPrimaryIntent(dir);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("intent");
		expect(result?.relativePath).toBe("src/tools/init/intent.aide");
	});

	it("returns null for a dir with no intent children (only research/plan/todo)", () => {
		const dir = makeDirNode("src/tools/init", [
			makeFileNode("src/tools/init/research.aide", "research"),
			makeFileNode("src/tools/init/plan.aide", "plan"),
			makeFileNode("src/tools/init/todo.aide", "todo"),
		]);
		const result = findPrimaryIntent(dir);
		expect(result).toBeNull();
	});

	it("returns null for a file-kind node input", () => {
		const fileNode = makeFileNode("src/cli/.aide", "intent");
		const result = findPrimaryIntent(fileNode);
		expect(result).toBeNull();
	});
});
