import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { TreeNodeModel } from "@/observer/page/types/index.js";
import TreeNode from "./index.js";

function makeNode(node: Partial<TreeNodeModel>): TreeNodeModel {
	return {
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
}

function render(node: Partial<TreeNodeModel>): string {
	return renderToStaticMarkup(<TreeNode node={makeNode(node)} onToggle={() => undefined} onOpenFile={() => undefined} />);
}

describe("TreeNode", () => {
	it("is a tree item at its indent step with a chevron button and a main button that folds the branch", () => {
		const html = render({});
		expect(html).toContain('<div class="av-node d2" role="treeitem">');
		expect(html).toContain('<button type="button" class="n-main leaf">');
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
		expect(html).toContain('<button type="button" class="n-main" aria-expanded="true">');
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

	it("lists the file chips under the node, each named by its file", () => {
		const html = render({
			chips: [
				{ kind: "brief", tone: "", icon: "doc", key: "brief.aide", value: null, file: "b" },
				{ kind: "todo", tone: "danger", icon: "issues", key: "todo.aide", value: "2 open of 4", file: "t" },
			],
		});
		expect(html).toContain('<span class="n-chips">');
		expect(stripMarkup(html)).toContain("brief.aidetodo.aide 2 open of 4");
	});

	it("draws no chip strip for a module with no chips", () => {
		expect(render({})).not.toContain("n-chips");
	});

	it("folds or unfolds the branch from both the chevron and the row, but a chip opens its file and nothing else", () => {
		const onToggle = vi.fn();
		const onOpenFile = vi.fn();
		const node = makeNode({
			hasChildren: true,
			chips: [{ kind: "plan", tone: "run", icon: "run", key: "plan.aide · approved", value: "1/3", file: "src/tools/score/plan.aide" }],
		});
		const tree = TreeNode({ node, onToggle, onOpenFile });
		const [chevron, row] = findElements({ node: tree, match: (element) => element.type === "button" && element.props.onClick === onToggle });
		expect(chevron?.props.className).toBe("tw");
		expect(row?.props.className).toBe("n-main");
		(chevron!.props.onClick as () => void)();
		(row!.props.onClick as () => void)();
		expect(onToggle).toHaveBeenCalledTimes(2);

		const [chips] = findElements({ node: tree, match: (element) => element.props.className === "n-chips" });
		const [chip] = findElements({ node: chips!.props.children, match: (element) => typeof element.props.onOpen === "function" });
		(chip!.props.onOpen as () => void)();
		expect(onOpenFile).toHaveBeenCalledWith("src/tools/score/plan.aide");
		expect(onToggle).toHaveBeenCalledTimes(2);
	});
});
