import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RailCell, RailCellState } from "@/observer/page/types/index.js";
import PhaseRail from "./index.js";

const BUILD_ROW: RailCell[] = [
	{ name: "Spec", state: "done", meta: "Done 2m 10s", loop: null },
	{ name: "Plan approval", state: "done", meta: "Approved 4m 12s", loop: null },
	{ name: "Build", state: "run", meta: "Step 4 of 9", loop: null },
	{ name: "QA", state: "todo", meta: "Not started", loop: null },
];

const FIX_ROW: RailCell[] = [
	{ name: "Build", state: "done", meta: "Done 9 of 9", loop: null },
	{ name: "QA", state: "fail", meta: "2 issues · round 2", loop: null },
	{ name: "Fix", state: "run", meta: "Round 2 · 1m 05s", loop: "round 2" },
	{ name: "Done", state: "todo", meta: "Not started", loop: null },
];

describe("PhaseRail", () => {
	it("gives a skipped cell the classes todo and skip with its `Skipped · <reason>` meta, and a pending cell todo without skip", () => {
		const cells: RailCell[] = [
			{ name: "Research", state: "todo", meta: "Skipped · domain known", loop: null, skipped: true },
			{ name: "QA", state: "todo", meta: "Not started", loop: null },
		];
		const html = renderToStaticMarkup(<PhaseRail phases={cells} />);
		expect(html).toContain('<li class="av-ph todo skip">');
		expect(html).toContain('<span class="p-meta">Skipped · domain known</span>');
		expect(html).toContain('<li class="av-ph todo"><span class="p-top"><span class="ic i-todo" aria-hidden="true"></span>QA</span>');
	});

	it("is a focusable, labelled region scroller named for what it holds, around one ordered list", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} />);
		expect(html.startsWith('<div class="av-rail-scroll" role="region" tabindex="0" aria-label="Pipeline phases; scrolls sideways on small screens"><ol class="av-rail">')).toBe(true);
		expect(html.match(/<li /g)).toHaveLength(BUILD_ROW.length);
	});

	it("draws Build as one cell: its name, its glyph and `Step 4 of 9`, with no loop badge", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} />);
		expect(html).toContain(
			'<li class="av-ph run"><span class="p-top"><span class="ic i-run" aria-hidden="true"></span>Build</span><span class="p-meta">Step 4 of 9</span></li>',
		);
		expect(html).not.toContain("p-loop");
	});

	it("draws QA failed and Fix round 2 as two cells, the loop badge on Fix only, without extra rows", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={FIX_ROW} />);
		expect(html).toContain(
			'<li class="av-ph fail"><span class="p-top"><span class="ic i-issues" aria-hidden="true"></span>QA</span><span class="p-meta">2 issues · round 2</span></li>',
		);
		expect(html).toContain(
			'<li class="av-ph run"><span class="p-loop"><span class="ic i-loop" aria-hidden="true"></span>round 2</span><span class="p-top"><span class="ic i-run" aria-hidden="true"></span>Fix</span><span class="p-meta">Round 2 · 1m 05s</span></li>',
		);
		expect(html.match(/p-loop"/g)).toHaveLength(1);
		expect(html.match(/<ol /g)).toHaveLength(1);
	});

	it.each([
		["todo", "i-todo", "Not started"],
		["run", "i-run", "Running 1m 52s"],
		["wait", "i-wait", "Waiting · 2m"],
		["done", "i-done", "Done 3m 41s"],
		["fail", "i-issues", "2 issues · round 1"],
	] as [RailCellState, string, string][])("a %s cell carries its class, the %s glyph and its words", (state, glyph, meta) => {
		const html = renderToStaticMarkup(<PhaseRail phases={[{ name: "Plan", state, meta, loop: null }]} />);
		expect(html).toContain(`<li class="av-ph ${state}">`);
		expect(html).toContain(`<span class="ic ${glyph}" aria-hidden="true"></span>Plan`);
		expect(html).toContain(`<span class="p-meta">${meta}</span>`);
	});

	it("names the pipeline in a footer after the row", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} pipeline="feature-x" />);
		expect(html).toContain('<p class="av-rail-foot"><span class="rf-pipe">Pipeline feature-x</span></p>');
		expect(html.indexOf("av-rail-foot")).toBeGreaterThan(html.indexOf("</ol>"));
		expect(html).not.toContain("Working outside the pipeline");
	});

	it("draws no footer for a session that reported no pipeline", () => {
		expect(renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} pipeline={null} />)).not.toContain("av-rail-foot");
		expect(renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} />)).not.toContain("av-rail-foot");
	});

	it("says `Working outside the pipeline` in the footer when the session works outside it", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} pipeline="feature-x" outside />);
		expect(html).toContain('<span class="rf-out">Working outside the pipeline</span>');
		expect(html).toContain("Pipeline feature-x");
		const alone = renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} pipeline={null} outside />);
		expect(alone).toContain('<p class="av-rail-foot"><span class="rf-out">Working outside the pipeline</span></p>');
	});

	it("draws nothing when the rail is hidden", () => {
		expect(renderToStaticMarkup(<PhaseRail phases={BUILD_ROW} pipeline="feature-x" outside hidden />)).toBe("");
	});

	it("offers no control", () => {
		const html = renderToStaticMarkup(<PhaseRail phases={FIX_ROW} />);
		expect(html).not.toContain("<button");
		expect(html).not.toContain("<a ");
	});
});
