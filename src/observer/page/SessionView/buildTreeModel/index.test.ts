import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import buildTreeModel from "./index.js";

function makeModule({ folder, overrides = {} }: { folder: string; overrides?: Partial<ModuleRow> }): ModuleRow {
	return {
		folder,
		label: folder === "." ? "root" : folder,
		description: `About ${folder}`,
		alignment: "aligned",
		intentFile: folder === "." ? ".aide/intent.aide" : `${folder}/.aide`,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
		...overrides,
	};
}

/** The root, `src` with three parents, and 39 leaves under them: 44 modules, three misaligned, three with open work. */
function makeBigProject(): ModuleRow[] {
	const modules = ["src/tools", "src/service", "src/cli"].map((folder) => makeModule({ folder }));
	for (let i = 0; i < 20; i++) modules.push(makeModule({ folder: `src/tools/t${i}` }));
	for (let i = 0; i < 12; i++) modules.push(makeModule({ folder: `src/service/s${i}` }));
	for (let i = 0; i < 7; i++) modules.push(makeModule({ folder: `src/cli/c${i}` }));
	const patch = ({ folder, overrides }: { folder: string; overrides: Partial<ModuleRow> }) => {
		const at = modules.findIndex((module) => module.folder === folder);
		modules[at] = { ...modules[at]!, ...overrides };
	};
	patch({ folder: "src/tools/t1", overrides: { plan: { file: "src/tools/t1/plan.aide", status: "approved", done: 3, total: 9 } } });
	patch({ folder: "src/tools/t2", overrides: { plan: { file: "src/tools/t2/plan.aide", status: "proposed", done: 0, total: 6 } } });
	patch({ folder: "src/tools/t3", overrides: { alignment: "misaligned", todo: { file: "src/tools/t3/todo.aide", open: 2, total: 4 } } });
	patch({ folder: "src/tools/t7", overrides: { alignment: "misaligned" } });
	patch({ folder: "src/service/s1", overrides: { alignment: "misaligned" } });
	patch({ folder: "src/service/s2", overrides: { plan: { file: "src/service/s2/plan.aide", status: "completed", done: 5, total: 5 } } });
	return [makeModule({ folder: "." }), makeModule({ folder: "src" }), ...modules];
}

describe("buildTreeModel", () => {
	const modules = makeBigProject();
	const tree = buildTreeModel({ modules, current: "src/tools/t5", currentLabel: "Working now · Build" });

	it("holds 44 modules in tree order, the root first and each parent before its children", () => {
		expect(modules).toHaveLength(44);
		expect(tree.entries).toHaveLength(44);
		expect(tree.entries.slice(0, 4).map((entry) => entry.folder)).toEqual([".", "src", "src/tools", "src/tools/t0"]);
		const folders = tree.entries.map((entry) => entry.folder);
		expect(folders.indexOf("src/service")).toBeGreaterThan(folders.indexOf("src/tools/t19"));
	});

	it("totals the modules, the misaligned ones and the ones with open work (open todo, or plan proposed or approved)", () => {
		expect(tree.counts).toEqual({ modules: 44, misaligned: 3, openWork: 3 });
	});

	it("prints the root as `root` at depth 0 and others one step per folder segment", () => {
		const byFolder = Object.fromEntries(tree.entries.map((entry) => [entry.folder, entry]));
		expect(byFolder["."]).toMatchObject({ path: "root", depth: 0 });
		expect(byFolder["src"]?.depth).toBe(1);
		expect(byFolder["src/tools"]?.depth).toBe(2);
		expect(byFolder["src/tools/t5"]?.depth).toBe(3);
	});

	it("records who has children, who sits above each node and how many modules are below", () => {
		const byFolder = Object.fromEntries(tree.entries.map((entry) => [entry.folder, entry]));
		expect(byFolder["src/service"]).toMatchObject({ hasChildren: true, descendants: 12, ancestors: [".", "src"] });
		expect(byFolder["."]?.descendants).toBe(43);
		expect(byFolder["src/service/s3"]).toMatchObject({ hasChildren: false, descendants: 0 });
	});

	it("labels only the current module, and marks the misaligned ones", () => {
		expect(tree.entries.filter((entry) => entry.current !== null).map((entry) => [entry.folder, entry.current])).toEqual([
			["src/tools/t5", "Working now · Build"],
		]);
		expect(tree.entries.filter((entry) => entry.misaligned).map((entry) => entry.folder)).toEqual(["src/tools/t3", "src/tools/t7", "src/service/s1"]);
	});

	it("starts with every parent collapsed, the root and the current module's ancestors included", () => {
		expect([...tree.initialCollapsed].sort()).toEqual([".", "src", "src/cli", "src/service", "src/tools"]);
	});

	it("labels nothing when no module is the working one", () => {
		const idle = buildTreeModel({ modules, current: null, currentLabel: null });
		expect(idle.entries.every((entry) => entry.current === null)).toBe(true);
	});

	it("gives a module its chips and a module with no intent spec no alignment", () => {
		const built = buildTreeModel({
			modules: [
				makeModule({ folder: ".", overrides: { brief: ".aide/brief.aide" } }),
				makeModule({ folder: "src", overrides: { intentFile: null, alignment: null } }),
			],
			current: null,
			currentLabel: null,
		});
		expect(built.entries[0]?.chips.map((chip) => chip.key)).toEqual(["intent.aide", "session.aide", "brief.aide"]);
		expect(built.entries[1]?.alignment).toBeNull();
	});
});
