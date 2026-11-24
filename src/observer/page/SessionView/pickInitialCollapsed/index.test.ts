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
	it("collapses nothing at 40 modules or fewer", () => {
		const modules = makeLarge({ leaves: 35 });
		expect(modules).toHaveLength(40);
		expect(pickInitialCollapsed({ modules, current: null }).size).toBe(0);
	});

	it("above 40, collapses every folder with children except the root", () => {
		const modules = makeLarge({ leaves: 39 });
		expect(modules).toHaveLength(44);
		const collapsed = pickInitialCollapsed({ modules, current: null });
		expect([...collapsed].sort()).toEqual(["lib", "src", "src/m0"]);
	});

	it("keeps the ancestors of the current module expanded", () => {
		const modules = makeLarge({ leaves: 39 });
		const collapsed = pickInitialCollapsed({ modules, current: "src/m0/inner" });
		expect([...collapsed].sort()).toEqual(["lib"]);
	});
});
