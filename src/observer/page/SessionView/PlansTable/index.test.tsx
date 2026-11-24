import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { PlanRowModel } from "@/observer/page/types/index.js";
import PlansTable from "./index.js";

const PLAN: PlanRowModel = {
	module: "src/tools/score",
	kind: "plan",
	status: "Approved",
	tone: "run",
	icon: "run",
	progress: "3/9 steps",
	percent: 33,
	highlighted: true,
	item: { kind: "file", path: "src/tools/score/plan.aide" },
};

const TODO: PlanRowModel = {
	module: "src/tools/validate",
	kind: "todo",
	status: "3 open",
	tone: "danger",
	icon: "issues",
	progress: "2/5 closed",
	percent: 40,
	highlighted: false,
	item: { kind: "file", path: "src/tools/validate/todo.aide" },
};

describe("PlansTable", () => {
	const html = renderToStaticMarkup(<PlansTable rows={[PLAN, TODO]} onOpen={() => undefined} />);

	it("is a labelled table with the four column headers, each row carrying the handoff's column template", () => {
		expect(html).toContain('<div class="av-gt" role="table" aria-label="Plans and todos">');
		const template = "grid-template-columns:minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.4fr)";
		expect(html).toContain(`<div class="tr th" role="row" style="${template}">`);
		expect(html.match(/role="columnheader"/g)).toHaveLength(4);
		expect(html.match(new RegExp(template.replace(/[()]/g, "\\$&"), "g"))).toHaveLength(3);
		expect(stripMarkup(html)).toContain("ModuleKindStatusProgress");
	});

	it("highlights the current module's row only", () => {
		expect(html.match(/class="tr hl"/g)).toHaveLength(1);
		expect(html).toContain('<div class="tr hl" role="row"');
		expect(html).toContain('<div class="tr" role="row"');
	});

	it("draws a plan row: module button, plan chip, status badge, bar and words", () => {
		expect(html).toContain('<button type="button" class="av-linkbtn mono">src/tools/score</button>');
		expect(html).toContain('<span class="av-chip"><span class="ic i-step" aria-hidden="true"></span>plan</span>');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Approved</span>');
		expect(html).toContain('<span role="cell" class="prog"><span class="av-prog" style="color:var(--run)"><i style="width:33%"></i></span>3/9 steps</span>');
	});

	it("draws a todo row with the issues chip and a danger badge that carries a glyph and words", () => {
		expect(html).toContain('<span class="av-chip"><span class="ic i-issues" aria-hidden="true"></span>todo</span>');
		expect(html).toContain('<span class="av-badge danger"><span class="ic i-issues" aria-hidden="true"></span>3 open</span>');
		expect(html).toContain('<i style="width:40%"></i></span>2/5 closed</span>');
	});

	it("shows the calm unavailable notice for a project that never reported its folder", () => {
		const text = renderToStaticMarkup(<PlansTable rows={null} onOpen={() => undefined} />);
		expect(text).toContain("<h3>Plans and todos unavailable</h3>");
		expect(stripMarkup(text)).toContain("They're read from the project folder, which this project hasn't reported yet.");
		expect(text).not.toContain("av-gt");
	});

	it("says calmly that no module holds a plan or todo, rather than drawing an empty table", () => {
		const text = renderToStaticMarkup(<PlansTable rows={[]} onOpen={() => undefined} />);
		expect(text).toContain("<h3>No plans or todos</h3>");
		expect(text).not.toContain("av-gt");
	});
});
