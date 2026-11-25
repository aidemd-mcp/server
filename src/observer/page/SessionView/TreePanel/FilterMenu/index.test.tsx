import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { TreeView } from "@/observer/page/types/index.js";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: vi.fn(actual.useState), useRef: vi.fn(actual.useRef), useEffect: vi.fn(actual.useEffect) };
});

import { useEffect, useRef, useState } from "react";
import FilterMenu from "./index.js";

const OFF: TreeView = { query: "", onlyOpen: false, onlyMisaligned: false, onlyPlans: false, onlyTodos: false, collapsed: new Set() };

/** Calls the menu as a function with its open state forced, since a static render cannot click. */
function renderOpen({ view, open, onChange }: { view: TreeView; open: boolean; onChange(view: TreeView): void }) {
	const setOpen = vi.fn();
	vi.mocked(useState).mockReturnValueOnce([open, setOpen] as never);
	vi.mocked(useRef).mockReturnValueOnce({ current: null } as never);
	vi.mocked(useEffect).mockImplementationOnce(() => undefined);
	return { tree: FilterMenu({ view, onChange }), setOpen };
}

describe("FilterMenu", () => {
	beforeEach(() => {
		vi.mocked(useState).mockClear();
	});

	it("is one closed Filters button with no count while no filter is on", () => {
		const html = renderToStaticMarkup(<FilterMenu view={OFF} onChange={() => undefined} />);
		expect(html).toBe(
			'<div class="av-filtermenu"><button type="button" class="av-btn" aria-expanded="false" aria-haspopup="true" aria-pressed="false">Filters<span class="ic i-chev-d" aria-hidden="true"></span></button></div>',
		);
	});

	it("says how many filters are on and draws the button pressed", () => {
		const html = renderToStaticMarkup(<FilterMenu view={{ ...OFF, onlyMisaligned: true, onlyPlans: true }} onChange={() => undefined} />);
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain('<span class="fm-n">2</span>');
		expect(html).not.toContain("av-filtermenu-list");
	});

	it("opens a labelled group of four checkboxes, each on as the view says", () => {
		const { tree } = renderOpen({ view: { ...OFF, onlyTodos: true }, open: true, onChange: () => undefined });
		const list = findElements({ node: tree, match: (element) => element.props.className === "av-filtermenu-list" });
		expect(list).toHaveLength(1);
		expect(list[0]!.props["aria-label"]).toBe("Tree filters");
		const boxes = findElements({ node: tree, match: (element) => element.type === "input" });
		expect(boxes.map((box) => box.props.checked)).toEqual([false, false, false, true]);
		const labels = findElements({ node: tree, match: (element) => element.type === "label" });
		expect(labels.map((label) => (label.props.children as unknown[])[1])).toEqual(["Only open work", "Only misaligned", "Has plan", "Has todo"]);
	});

	it("toggles one filter through onChange and leaves the rest of the view as it was", () => {
		const onChange = vi.fn();
		const view = { ...OFF, query: "src", collapsed: new Set(["src"]) };
		const { tree } = renderOpen({ view, open: true, onChange });
		const boxes = findElements({ node: tree, match: (element) => element.type === "input" });
		(boxes[2]!.props.onChange as () => void)();
		expect(onChange).toHaveBeenCalledWith({ ...view, onlyPlans: true });
	});

	it("offers Clear filters only while one is on, and clearing turns all four off", () => {
		const none = renderOpen({ view: OFF, open: true, onChange: () => undefined });
		expect(findElements({ node: none.tree, match: (element) => element.props.className === "av-btn ghost fm-clear" })).toEqual([]);

		const onChange = vi.fn();
		const view = { ...OFF, onlyOpen: true, onlyTodos: true, query: "src" };
		const some = renderOpen({ view, open: true, onChange });
		const [clear] = findElements({ node: some.tree, match: (element) => element.props.className === "av-btn ghost fm-clear" });
		expect(stripMarkup(renderToStaticMarkup(clear!))).toBe("Clear filters");
		(clear!.props.onClick as () => void)();
		expect(onChange).toHaveBeenCalledWith({ ...OFF, query: "src" });
	});

	it("opens and closes from its button", () => {
		const closed = renderOpen({ view: OFF, open: false, onChange: () => undefined });
		const [button] = findElements({ node: closed.tree, match: (element) => element.type === "button" });
		(button!.props.onClick as () => void)();
		expect(closed.setOpen).toHaveBeenCalledWith(true);

		const open = renderOpen({ view: OFF, open: true, onChange: () => undefined });
		const [toggle] = findElements({ node: open.tree, match: (element) => element.type === "button" });
		(toggle!.props.onClick as () => void)();
		expect(open.setOpen).toHaveBeenCalledWith(false);
	});
});
