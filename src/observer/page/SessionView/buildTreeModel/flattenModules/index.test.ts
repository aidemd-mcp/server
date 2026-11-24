import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import flattenModules from "./index.js";

function row(folder: string): ModuleRow {
	return { folder, label: folder, description: null, alignment: null, intentFile: null, brief: null, plan: null, todo: null, research: null, malformed: [] };
}

describe("flattenModules", () => {
	it("is empty with no modules", () => {
		expect(flattenModules({ modules: [] })).toEqual([]);
	});

	it("lists the root first, then each module's children depth first", () => {
		const flat = flattenModules({ modules: [row("."), row("src"), row("src/a"), row("src/a/deep"), row("src/b"), row("docs")] });
		expect(flat.map((entry) => entry.module.folder)).toEqual([".", "src", "src/a", "src/a/deep", "src/b", "docs"]);
	});

	it("carries each module's ancestors, nearest last", () => {
		const flat = flattenModules({ modules: [row("."), row("src"), row("src/a")] });
		expect(flat.map((entry) => entry.ancestors)).toEqual([[], ["."], [".", "src"]]);
	});

	it("counts every descendant at any depth and flags the modules that have children", () => {
		const flat = flattenModules({ modules: [row("."), row("src"), row("src/a"), row("src/a/deep"), row("docs")] });
		const byFolder = new Map(flat.map((entry) => [entry.module.folder, entry]));
		expect(byFolder.get(".")).toMatchObject({ descendants: 4, hasChildren: true });
		expect(byFolder.get("src")).toMatchObject({ descendants: 2, hasChildren: true });
		expect(byFolder.get("src/a")).toMatchObject({ descendants: 1, hasChildren: true });
		expect(byFolder.get("src/a/deep")).toMatchObject({ descendants: 0, hasChildren: false });
		expect(byFolder.get("docs")).toMatchObject({ descendants: 0, hasChildren: false });
	});

	it("starts one branch per top module when no root row is listed", () => {
		const flat = flattenModules({ modules: [row("src"), row("src/a"), row("docs")] });
		expect(flat.map((entry) => [entry.module.folder, entry.ancestors])).toEqual([
			["src", []],
			["src/a", ["src"]],
			["docs", []],
		]);
	});
});
