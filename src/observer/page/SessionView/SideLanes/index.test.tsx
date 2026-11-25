import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LaneCell } from "@/observer/page/types/index.js";
import SideLanes from "./index.js";

const LANES: LaneCell[] = [
	{ name: "Structure", state: "done", meta: "Done" },
	{ name: "Align", state: "run", meta: "Running" },
	{ name: "Refactor", state: "todo", meta: "Not started" },
	{ name: "Cleanup", state: "fail", meta: "Not started" },
];

describe("SideLanes", () => {
	it("starts with the Side lanes label and draws one pill per lane", () => {
		const html = renderToStaticMarkup(<SideLanes lanes={LANES} />);
		expect(html.startsWith('<div class="av-lanes"><span class="l-lbl">Side lanes</span>')).toBe(true);
		expect(html.match(/class="av-lane /g)).toHaveLength(4);
	});

	it.each([
		["Structure", "done", "i-done", "Done"],
		["Align", "run", "i-run", "Running"],
		["Refactor", "todo", "i-todo", "Not started"],
		["Cleanup", "fail", "i-issues", "Not started"],
	])("the %s lane carries its %s class, its %s glyph and the word %s", (name, state, glyph, meta) => {
		const html = renderToStaticMarkup(<SideLanes lanes={LANES} />);
		expect(html).toContain(`<span class="av-lane ${state}"><span class="ic ${glyph}" aria-hidden="true"></span>${name} <span class="s">${meta}</span></span>`);
	});

	it("draws a skipped lane in the not-started look with its reason", () => {
		const html = renderToStaticMarkup(<SideLanes lanes={[{ name: "Align", state: "todo", meta: "Skipped · no spec change", skipped: true }]} />);
		expect(html).toContain('<span class="av-lane todo skip"><span class="ic i-todo" aria-hidden="true"></span>Align <span class="s">Skipped · no spec change</span></span>');
	});

	it("draws nothing when the rail is hidden", () => {
		expect(renderToStaticMarkup(<SideLanes lanes={LANES} hidden />)).toBe("");
	});
});
