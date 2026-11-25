import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { ModuleRow, TreeView } from "@/observer/page/types/index.js";
import buildTreeModel from "@/observer/page/SessionView/buildTreeModel/index.js";
import initTreeView from "@/observer/page/SessionView/TabPanel/useTreeView/initTreeView/index.js";
import TreePanel from "./index.js";

function makeModule(folder: string, overrides: Partial<ModuleRow> = {}): ModuleRow {
	return {
		folder,
		label: folder === "." ? "root" : folder,
		description: `About ${folder}`,
		alignment: "aligned",
		intentFile: `${folder}/.aide`,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
		...overrides,
	};
}

function render(modules: ModuleRow[], current: string | null = null, change: Partial<TreeView> = {}): string {
	const tree = buildTreeModel({ modules, current, currentLabel: current === null ? null : "Working now · Build" });
	const view = { ...initTreeView({ tree }), ...change };
	return renderToStaticMarkup(<TreePanel tree={tree} view={view} onChange={() => undefined} onOpen={() => undefined} />);
}

describe("TreePanel", () => {
	it("draws the toolbar: a labelled path filter, the Filters dropdown closed with nothing on, one Expand all toggle and the count line", () => {
		const html = render([makeModule("."), makeModule("src"), makeModule("src/a", { alignment: "misaligned" })]);
		expect(html).toContain('<span class="sr">Filter modules by path</span><input type="search" placeholder="Filter by path" value=""/>');
		expect(html).toContain('aria-haspopup="true" aria-pressed="false">Filters<span class="ic i-chev-d" aria-hidden="true"></span></button>');
		expect(html).not.toContain("Only open work");
		expect(html).not.toContain("Only misaligned");
		expect(html).toContain('<button type="button" class="av-btn ghost"><span class="ic i-chev-d" aria-hidden="true"></span>Expand all</button>');
		expect(html).not.toContain("Collapse all");
		expect(html).toContain('<span class="count">3 modules · 1 misaligned · 0 with open work · showing 1</span>');
		expect(html).toContain('<div class="av-tree" role="tree" aria-label="Intent tree">');
	});

	it("sets the filter field's size from the handoff", () => {
		expect(render([makeModule(".")])).toContain('<label class="av-field" style="flex:1 1 200px;max-width:300px">');
	});

	it("starts a 44-module tree fully collapsed to the root, naming what it hides and saying what the count line hides", () => {
		const modules = [makeModule("."), makeModule("src"), makeModule("src/tools"), makeModule("src/service")];
		for (let i = 0; i < 20; i++) modules.push(makeModule(`src/tools/t${i}`));
		for (let i = 0; i < 20; i++) modules.push(makeModule(`src/service/s${i}`));
		const html = render(modules, "src/tools/t5");
		expect(modules).toHaveLength(44);
		expect(html).toContain('<span class="n-more">43 modules hidden</span>');
		expect(html).not.toContain("src/tools/t19");
		expect(html).not.toContain("src/service/s0");
		expect(stripMarkup(html)).toContain("44 modules · 0 misaligned · 0 with open work · showing 1");
	});

	it("starts a small tree collapsed too: the root alone, naming the modules it hides", () => {
		const html = render([makeModule("."), makeModule("src"), makeModule("src/a")]);
		expect(stripMarkup(html)).toContain("showing 1");
		expect(html).toContain('<span class="n-path">root</span>');
		expect(html).toContain('<span class="n-more">2 modules hidden</span>');
		expect(html).not.toContain("src/a");
	});

	it("names the toggle Collapse all while no folder is folded", () => {
		const open = render([makeModule("."), makeModule("src"), makeModule("src/a")], null, { collapsed: new Set() });
		expect(open).toContain("Collapse all");
		expect(open).not.toContain("Expand all");
	});

	it("draws the filter, toggles and folding it is given, so they can outlive the panel", () => {
		const modules = [makeModule("."), makeModule("src"), makeModule("src/a", { alignment: "misaligned" }), makeModule("src/b")];
		const html = render(modules, null, { query: "src/a", onlyMisaligned: true });
		expect(html).toContain('value="src/a"');
		expect(html).toContain('aria-pressed="true">Filters<span class="fm-n">1</span>');
		expect(html).not.toContain("src/b");
		expect(render(modules, null, { collapsed: new Set(["src"]) })).not.toContain("src/a");
	});

	it("names the working module with its label once its folder is open", () => {
		expect(stripMarkup(render([makeModule("."), makeModule("src")], "src", { collapsed: new Set() }))).toContain("Working now · Build");
	});

	it("flattens to the modules holding a plan under Has plan, and a todo under Has todo", () => {
		const modules = [
			makeModule("."),
			makeModule("src"),
			makeModule("src/a", { plan: { file: "src/a/plan.aide", status: "approved", done: 1, total: 3 } }),
			makeModule("src/b", { todo: { file: "src/b/todo.aide", open: 1, total: 2 } }),
		];
		const plans = render(modules, null, { onlyPlans: true });
		expect(plans).toContain("src/a");
		expect(plans).not.toContain("src/b");
		const todos = render(modules, null, { onlyTodos: true });
		expect(todos).toContain("src/b");
		expect(todos).not.toContain("src/a");
	});

	it("names each file on a chip and says so when no module matches", () => {
		const modules = [makeModule(".", { intentFile: ".aide/intent.aide" }), makeModule("src", { plan: { file: "src/plan.aide", status: "approved", done: 1, total: 3 } })];
		const text = stripMarkup(render(modules, null, { collapsed: new Set() }));
		expect(text).toContain("intent.aide");
		expect(text).toContain("plan.aide · approved 1/3");
		expect(render(modules, null, { query: "nothing-here" })).toContain("No modules match these filters.");
	});

	it("sends every change out through onChange: the toggle, a row's fold, and a chip's file", () => {
		const modules = [makeModule("."), makeModule("src"), makeModule("src/a")];
		const tree = buildTreeModel({ modules, current: null, currentLabel: null });
		const onChange = vi.fn();
		const onOpen = vi.fn();
		const call = (view: TreeView) => TreePanel({ tree, view, onChange, onOpen });
		const toggles = (view: TreeView) =>
			findElements({ node: call(view), match: (element) => typeof element.props.className === "string" && element.props.className.startsWith("av-btn ghost") });

		const folded = initTreeView({ tree });
		(toggles(folded)[0]!.props.onClick as () => void)();
		expect(onChange).toHaveBeenLastCalledWith({ ...folded, collapsed: new Set() });

		const open = { ...folded, collapsed: new Set<string>() };
		(toggles(open)[0]!.props.onClick as () => void)();
		expect(onChange).toHaveBeenLastCalledWith({ ...open, collapsed: new Set([".", "src"]) });

		const [root] = findElements({ node: call(folded), match: (element) => typeof element.props.onToggle === "function" });
		(root!.props.onToggle as () => void)();
		expect(onChange).toHaveBeenLastCalledWith({ ...folded, collapsed: new Set(["src"]) });

		(root!.props.onOpenFile as (path: string) => void)("src/.aide");
		expect(onOpen).toHaveBeenCalledWith({ kind: "file", path: "src/.aide" });
	});

	it("shows the calm unavailable notice for a project that never reported its folder", () => {
		const html = renderToStaticMarkup(<TreePanel tree={{ kind: "unavailable" }} view={initTreeView({ tree: { kind: "unavailable" } })} onChange={() => undefined} onOpen={() => undefined} />);
		expect(html).toContain('<div class="av-notice calm">');
		expect(html).toContain("<h3>Intent tree unavailable</h3>");
		expect(stripMarkup(html)).toContain(
			"This project never reported its folder, so there's no .aide tree to read. It appears after the agent starts a session that reports the project root. History and sessions below still work.",
		);
		expect(html).not.toContain("av-toolbar");
		expect(html).not.toContain('role="tree"');
	});
});
