import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { DrawerContext } from "@/observer/page/types/index.js";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: vi.fn(actual.useState), useEffect: vi.fn(actual.useEffect) };
});

import { useEffect, useState } from "react";
import SidePanel from "./index.js";

const context: DrawerContext = { token: "tok", projectKey: "app-abc123", status: null, events: [], sessions: [], focus: "s1", now: new Date() };

/** Calls the panel as a function with its collapsed state forced, since a static render cannot click. */
function renderWith({ collapsed }: { collapsed: boolean }) {
	const setCollapsed = vi.fn();
	vi.mocked(useState).mockReturnValueOnce([collapsed, setCollapsed] as never);
	vi.mocked(useEffect).mockImplementationOnce(() => undefined);
	return { tree: SidePanel({ item: null, context }), setCollapsed };
}

describe("SidePanel", () => {
	beforeEach(() => {
		vi.mocked(useState).mockClear();
	});

	it("shows a calm prompt to pick something when no item is open", () => {
		const html = renderToStaticMarkup(<SidePanel item={null} context={context} />);
		expect(html).toContain('<div class="av-sidepanel">');
		expect(html).toContain('<div class="av-side-empty">');
		expect(stripMarkup(html)).toContain("Click a module, plan, task or history event to read it here.");
		expect(html).not.toContain("av-drawer");
	});

	it("draws the selected item's detail docked in place of the prompt", () => {
		const html = renderToStaticMarkup(<SidePanel item={{ kind: "task", slug: "fix-it" }} context={context} />);
		expect(html).toContain("fix-it");
		expect(html).not.toContain("av-side-empty");
		expect(html).toContain('<div class="av-sidepanel">');
	});

	it("starts open, with a Hide button in its corner", () => {
		const html = renderToStaticMarkup(<SidePanel item={null} context={context} />);
		expect(html).toContain('aria-expanded="true" aria-label="Hide details"');
		expect(html).not.toContain("av-sidetab");
	});

	it("collapses to a slim vertical Details tab when Hide is pressed", () => {
		const open = renderWith({ collapsed: false });
		const [hide] = findElements({ node: open.tree, match: (element) => element.props["aria-label"] === "Hide details" });
		(hide!.props.onClick as () => void)();
		expect(open.setCollapsed).toHaveBeenCalledWith(true);

		const closed = renderWith({ collapsed: true });
		const html = renderToStaticMarkup(<>{closed.tree}</>);
		expect(html).toContain('<button type="button" class="av-sidetab" aria-expanded="false" aria-label="Show details">');
		expect(html).toContain('<span class="t">Details</span>');
		expect(html).not.toContain("av-sidepanel");
		expect(html).not.toContain("av-side-empty");
	});

	it("brings the column back when the tab is pressed", () => {
		const closed = renderWith({ collapsed: true });
		(closed.tree.props.onClick as () => void)();
		expect(closed.setCollapsed).toHaveBeenCalledWith(false);
	});
});
