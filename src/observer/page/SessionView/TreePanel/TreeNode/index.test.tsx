import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { TreeNodeModel } from "@/observer/page/types/index.js";
import TreeNode from "./index.js";

function render(node: Partial<TreeNodeModel>): string {
	const model: TreeNodeModel = {
		folder: "src/tools/score",
		path: "src/tools/score",
		depth: 2,
		description: "Ranks specs",
		alignment: "aligned",
		chips: [],
		current: null,
		misaligned: false,
		hasChildren: false,
		collapsed: false,
		hiddenCount: 0,
		...node,
	};
	return renderToStaticMarkup(<TreeNode node={model} onToggle={() => undefined} onOpen={() => undefined} />);
}

describe("TreeNode", () => {
	it("is a tree item at its indent step with a chevron button and a main button that opens the module", () => {
		const html = render({});
		expect(html).toContain('<div class="av-node d2" role="treeitem">');
		expect(html).toContain('<button type="button" class="n-main">');
		expect(html).toContain('<span class="n-path">src/tools/score</span>');
		expect(html).toContain('<span class="n-desc">Ranks specs</span>');
	});

	it("hides a leaf's chevron with the leaf class, names it, and leaves aria-expanded off", () => {
		const html = render({});
		expect(html).toContain('<button type="button" class="tw leaf" aria-label="Collapse src/tools/score">');
		expect(html).not.toContain("aria-expanded");
	});

	it("draws an open parent expanded with a down chevron named Collapse", () => {
		const html = render({ hasChildren: true });
		expect(html).toContain('role="treeitem" aria-expanded="true"');
		expect(html).toContain('<button type="button" class="tw" aria-label="Collapse src/tools/score"><span class="ic i-chev-d" aria-hidden="true"></span></button>');
	});

	it("draws a collapsed parent with a right chevron named Expand and says how many modules it hides", () => {
		const html = render({ hasChildren: true, collapsed: true, hiddenCount: 12 });
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain('aria-label="Expand src/tools/score"><span class="ic i-chev-r" aria-hidden="true"></span>');
		expect(html).toContain('<span class="n-more">12 modules hidden</span>');
	});

	it("says `1 module hidden` for a single hidden module", () => {
		expect(render({ hasChildren: true, collapsed: true, hiddenCount: 1 })).toContain('<span class="n-more">1 module hidden</span>');
	});

	it("says nothing about hidden modules on an open node", () => {
		expect(render({ hasChildren: true })).not.toContain("n-more");
	});

	it("tints the working module and names it with a run badge and its words", () => {
		const html = render({ current: "Working now · Build" });
		expect(html).toContain('class="av-node d2 cur"');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Working now · Build</span>');
	});

	it("tints a misaligned module and gives it the solid red badge with the cross and the word", () => {
		const html = render({ misaligned: true, alignment: "misaligned" });
		expect(html).toContain('class="av-node d2 mis"');
		expect(html).toContain('<span class="av-badge strong-danger"><span class="ic i-fail" aria-hidden="true"></span>Misaligned</span>');
	});

	it("draws no badge for a module with no intent spec, and no description line without a description", () => {
		const html = render({ alignment: null, description: null });
		expect(html).not.toContain("av-badge");
		expect(html).not.toContain("n-desc");
	});

	it("lists the file chips under the node", () => {
		const html = render({
			chips: [
				{ kind: "brief", tone: "", icon: "doc", key: "brief", value: null, file: "b" },
				{ kind: "todo", tone: "danger", icon: "issues", key: "todo", value: "2 open of 4", file: "t" },
			],
		});
		expect(html).toContain('<span class="n-chips">');
		expect(stripMarkup(html)).toContain("brieftodo 2 open of 4");
	});
});
