import { describe, expect, it } from "vitest";
import type { ModuleRow, TreeData } from "@/observer/page/types/index.js";
import buildTreeModel from "@/observer/page/SessionView/buildTreeModel/index.js";
import buildTreeRows from "./index.js";

function makeModule({ folder, overrides = {} }: { folder: string; overrides?: Partial<ModuleRow> }): ModuleRow {
	return {
		folder,
		label: folder === "." ? ".aide/intent.aide" : folder,
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

/** 44 modules: the root, `src`, three parents with 20, 12 and 7 leaves; t3 is misaligned with open work, t7 and s1 misaligned, t1 and t2 hold open plans. */
function makeTree(): TreeData {
	const modules = [makeModule({ folder: "." }), makeModule({ folder: "src" })];
	const groups: [string, string, number][] = [
		["src/tools", "t", 20],
		["src/service", "s", 12],
		["src/cli", "c", 7],
	];
	for (const [parent, prefix, leaves] of groups) {
		modules.push(makeModule({ folder: parent }));
		for (let i = 0; i < leaves; i++) modules.push(makeModule({ folder: `${parent}/${prefix}${i}` }));
	}
	const patch = ({ folder, overrides }: { folder: string; overrides: Partial<ModuleRow> }) => {
		const at = modules.findIndex((module) => module.folder === folder);
		modules[at] = { ...modules[at]!, ...overrides };
	};
	patch({ folder: "src/tools/t1", overrides: { plan: { file: "p1", status: "approved", done: 1, total: 3 } } });
	patch({ folder: "src/tools/t2", overrides: { plan: { file: "p2", status: "proposed", done: 0, total: 3 } } });
	patch({ folder: "src/tools/t3", overrides: { alignment: "misaligned", todo: { file: "t3", open: 1, total: 2 } } });
	patch({ folder: "src/tools/t7", overrides: { alignment: "misaligned" } });
	patch({ folder: "src/service/s1", overrides: { alignment: "misaligned" } });
	return buildTreeModel({ modules, current: "src/tools/t5", currentLabel: "Working now · Build" });
}

const OFF = { query: "", onlyOpen: false, onlyMisaligned: false };

describe("buildTreeRows", () => {
	const tree = makeTree();

	it("is 44 modules before any collapse, the count line stating the totals with nothing hidden", () => {
		expect(tree.counts.modules).toBe(44);
		const { nodes, countLine } = buildTreeRows({ tree, ...OFF, collapsed: new Set() });
		expect(nodes).toHaveLength(44);
		expect(countLine).toBe("44 modules · 3 misaligned · 3 with open work");
	});

	it("hides a collapsed folder's children and says how many, in the node and in the count line", () => {
		const { nodes, countLine } = buildTreeRows({ tree, ...OFF, collapsed: new Set(["src/service", "src/cli"]) });
		expect(nodes).toHaveLength(44 - 12 - 7);
		expect(nodes.find((node) => node.folder === "src/service")).toMatchObject({ collapsed: true, hiddenCount: 12 });
		expect(nodes.find((node) => node.folder === "src/cli")).toMatchObject({ collapsed: true, hiddenCount: 7 });
		expect(nodes.find((node) => node.folder === "src/tools")).toMatchObject({ collapsed: false, hiddenCount: 0 });
		expect(nodes.some((node) => node.folder.startsWith("src/service/"))).toBe(false);
		expect(countLine).toBe("44 modules · 3 misaligned · 3 with open work · showing 25");
	});

	it("hides everything under a collapsed root and names the 43 it hid", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, collapsed: new Set(["."]) });
		expect(nodes.map((node) => node.folder)).toEqual(["."]);
		expect(nodes[0]).toMatchObject({ collapsed: true, hiddenCount: 43 });
	});

	it("hides a nested folder's descendants when a folder above it is collapsed", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, collapsed: new Set(["src"]) });
		expect(nodes.map((node) => node.folder)).toEqual([".", "src"]);
		expect(nodes[1]?.hiddenCount).toBe(42);
	});

	it("never marks a leaf collapsed, even if its folder is in the set", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, collapsed: new Set(["src/tools/t0"]) });
		expect(nodes.find((node) => node.folder === "src/tools/t0")).toMatchObject({ collapsed: false, hiddenCount: 0, hasChildren: false });
	});

	it("only open work flattens to the modules with an open todo or a proposed or approved plan, full paths at depth 0, no chevrons", () => {
		const { nodes, countLine } = buildTreeRows({ tree, ...OFF, onlyOpen: true, collapsed: new Set(["src"]) });
		expect(nodes.map((node) => node.path)).toEqual(["src/tools/t1", "src/tools/t2", "src/tools/t3"]);
		expect(nodes.every((node) => node.depth === 0 && !node.hasChildren && !node.collapsed && node.hiddenCount === 0)).toBe(true);
		expect(countLine).toBe("44 modules · 3 misaligned · 3 with open work · showing 3");
	});

	it("only misaligned lists the misaligned modules", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, onlyMisaligned: true, collapsed: new Set() });
		expect(nodes.map((node) => node.path)).toEqual(["src/tools/t3", "src/tools/t7", "src/service/s1"]);
		expect(nodes.every((node) => node.misaligned)).toBe(true);
	});

	it("both toggles together keep only the modules that are both", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, onlyOpen: true, onlyMisaligned: true, collapsed: new Set() });
		expect(nodes.map((node) => node.path)).toEqual(["src/tools/t3"]);
	});

	it("filters on the path, ignoring case and surrounding space, and never on the description", () => {
		const byPath = buildTreeRows({ tree, ...OFF, query: "  SERVICE/S1 ", collapsed: new Set() });
		expect(byPath.nodes.map((node) => node.path)).toEqual(["src/service/s1", "src/service/s10", "src/service/s11"]);
		const byDescription = buildTreeRows({ tree, ...OFF, query: "about src/cli", collapsed: new Set() });
		expect(byDescription.nodes).toEqual([]);
	});

	it("filters on the root's printed path", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, query: "intent.aide", collapsed: new Set() });
		expect(nodes.map((node) => node.folder)).toEqual(["."]);
	});

	it("says showing 0 when nothing matches", () => {
		const { nodes, countLine } = buildTreeRows({ tree, ...OFF, query: "nothing-here", collapsed: new Set() });
		expect(nodes).toEqual([]);
		expect(countLine).toBe("44 modules · 3 misaligned · 3 with open work · showing 0");
	});

	it("carries each node's badge, chips, label and the current marker through", () => {
		const { nodes } = buildTreeRows({ tree, ...OFF, collapsed: new Set() });
		expect(nodes.find((node) => node.folder === "src/tools/t5")).toMatchObject({ current: "Working now · Build", alignment: "aligned" });
		expect(nodes.find((node) => node.folder === "src/tools/t1")?.chips.map((chip) => chip.key)).toEqual(["plan · approved"]);
	});
});
