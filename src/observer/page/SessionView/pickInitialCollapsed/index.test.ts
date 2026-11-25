import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import pickInitialCollapsed from "./index.js";

function makeModule(folder: string): ModuleRow {
	return {
		folder,
		label: folder,
		description: null,
		alignment: null,
		intentFile: null,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
	};
}

/** The root, `src` with `src/m0`..`src/m<count-1>` leaves, a second parent `lib` with one leaf, and `src/m0/inner`. */
function makeLarge({ leaves }: { leaves: number }): ModuleRow[] {
	const modules = [makeModule("."), makeModule("src"), makeModule("lib"), makeModule("lib/one"), makeModule("src/m0/inner")];
	for (let i = 0; i < leaves; i++) modules.push(makeModule(`src/m${i}`));
	return modules;
}

describe("pickInitialCollapsed", () => {
	it("collapses every folder with children, the root included, however small the tree", () => {
		const modules = makeLarge({ leaves: 3 });
		const collapsed = pickInitialCollapsed({ modules, current: null });
		expect([...collapsed].sort()).toEqual([".", "lib", "src", "src/m0"]);
	});

	it("collapses the same folders in a 44-module tree", () => {
		const modules = makeLarge({ leaves: 39 });
		expect(modules).toHaveLength(44);
		expect([...pickInitialCollapsed({ modules, current: null })].sort()).toEqual([".", "lib", "src", "src/m0"]);
	});

	it("leaves a leaf-only tree with nothing collapsed", () => {
		expect(pickInitialCollapsed({ modules: [makeModule("src")], current: null }).size).toBe(0);
	});

	it("starts fully collapsed even around the current module", () => {
		const modules = makeLarge({ leaves: 3 });
		const collapsed = pickInitialCollapsed({ modules, current: "src/m0/inner" });
		expect([...collapsed].sort()).toEqual([".", "lib", "src", "src/m0"]);
	});
});
