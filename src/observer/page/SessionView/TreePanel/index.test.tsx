import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { ModuleRow, TreeView } from "@/observer/page/types/index.js";
import buildTreeModel from "@/observer/page/SessionView/buildTreeModel/index.js";
import initTreeView from "@/observer/page/SessionView/TabPanel/useTreeView/initTreeView/index.js";
import TreePanel from "./index.js";

function makeModule(folder: string, overrides: Partial<ModuleRow> = {}): ModuleRow {
	return {
		folder,
		label: folder === "." ? ".aide/intent.aide" : folder,
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
	it("draws the toolbar: a labelled path filter, two toggles off, Expand all, Collapse all and the count line", () => {
		const html = render([makeModule("."), makeModule("src"), makeModule("src/a", { alignment: "misaligned" })]);
		expect(html).toContain('<span class="sr">Filter modules by path</span><input type="search" placeholder="Filter by path" value=""/>');
		expect(html).toContain('<button type="button" class="av-btn" aria-pressed="false">Only open work</button>');
		expect(html).toContain('<button type="button" class="av-btn" aria-pressed="false">Only misaligned</button>');
		expect(html).toContain('<button type="button" class="av-btn ghost">Expand all</button>');
		expect(html).toContain('<button type="button" class="av-btn ghost">Collapse all</button>');
		expect(html).toContain('<span class="count">3 modules · 1 misaligned · 0 with open work</span>');
		expect(html).toContain('<div class="av-tree" role="tree" aria-label="Intent tree">');
	});

	it("sets the filter field's size from the handoff", () => {
		expect(render([makeModule(".")])).toContain('<label class="av-field" style="flex:1 1 200px;max-width:300px">');
	});

	it("starts a 44-module tree with the folders that hold the rest folded, naming what they hide, and says what the count line hides", () => {
		const modules = [makeModule("."), makeModule("src"), makeModule("src/tools"), makeModule("src/service")];
		for (let i = 0; i < 20; i++) modules.push(makeModule(`src/tools/t${i}`));
		for (let i = 0; i < 20; i++) modules.push(makeModule(`src/service/s${i}`));
		const html = render(modules, "src/tools/t5");
		expect(modules).toHaveLength(44);
		expect(html).toContain('<span class="n-more">20 modules hidden</span>');
		expect(html).toContain("src/tools/t19");
		expect(html).not.toContain("src/service/s0");
		expect(stripMarkup(html)).toContain("44 modules · 0 misaligned · 0 with open work · showing 24");
	});

	it("draws the filter, toggles and folding it is given, so they can outlive the panel", () => {
		const modules = [makeModule("."), makeModule("src"), makeModule("src/a", { alignment: "misaligned" }), makeModule("src/b")];
		const html = render(modules, null, { query: "src/a", onlyMisaligned: true });
		expect(html).toContain('value="src/a"');
		expect(html).toContain('<button type="button" class="av-btn" aria-pressed="true">Only misaligned</button>');
		expect(html).toContain('<button type="button" class="av-btn" aria-pressed="false">Only open work</button>');
		expect(html).not.toContain("src/b");
		expect(render(modules, null, { collapsed: new Set(["src"]) })).not.toContain("src/a");
	});

	it("names the working module with its label", () => {
		expect(stripMarkup(render([makeModule("."), makeModule("src")], "src"))).toContain("Working now · Build");
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
