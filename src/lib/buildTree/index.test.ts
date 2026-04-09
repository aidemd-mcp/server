import { describe, it, expect } from "vitest";
import buildTree from "./index.js";
import type { AideFile } from "../../types/index.js";

function makeAideFile(relativePath: string, type: AideFile["type"], summary = ""): AideFile {
	return { path: `/project/${relativePath}`, relativePath, type, summary };
}

describe("buildTree", () => {
	it("renders a single file at root", () => {
		const files = [makeAideFile(".aide", "intent", "Root spec for the project")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("./");
		expect(tree).toContain(".aide [intent]");
		expect(tree).toContain("Root spec for the project");
	});

	it("groups files by directory", () => {
		const files = [
			makeAideFile("src/.aide", "intent", "Source spec"),
			makeAideFile("src/lib/.aide", "intent", "Lib spec"),
		];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("src/");
		expect(tree).toContain("src/lib/");
	});

	it("sorts files by type then name within a directory", () => {
		const files = [
			makeAideFile("src/research.aide", "research", "Research"),
			makeAideFile("src/intent.aide", "intent", "Intent"),
			makeAideFile("src/todo.aide", "todo", "Todo"),
		];
		const tree = buildTree(files, "/project");
		const lines = tree.split("\n");

		// intent should come before research, research before todo
		const intentIdx = lines.findIndex((l) => l.includes("[intent]"));
		const researchIdx = lines.findIndex((l) => l.includes("[research]"));
		const todoIdx = lines.findIndex((l) => l.includes("[todo]"));

		expect(intentIdx).toBeLessThan(researchIdx);
		expect(researchIdx).toBeLessThan(todoIdx);
	});

	it("uses tree-drawing characters", () => {
		const files = [
			makeAideFile("src/.aide", "intent", "First"),
			makeAideFile("src/research.aide", "research", "Second"),
		];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("├──");
		expect(tree).toContain("└──");
	});

	it("returns empty string for no files", () => {
		expect(buildTree([], "/project")).toBe("");
	});

	it("includes summary after dash separator", () => {
		const files = [makeAideFile("src/.aide", "intent", "Strategy and contracts")];
		const tree = buildTree(files, "/project");

		expect(tree).toContain("— Strategy and contracts");
	});
});
