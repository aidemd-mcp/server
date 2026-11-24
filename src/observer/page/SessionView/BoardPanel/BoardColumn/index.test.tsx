import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { BoardColumnModel, TaskCardModel } from "@/observer/page/types/index.js";
import BoardColumn from "./index.js";

function cards(count: number): TaskCardModel[] {
	return Array.from({ length: count }, (_, index) => ({ slug: `task-${index}`, title: `Task ${index}`, priority: "p2" as const, type: null, linked: false, unreadable: null }));
}

function render({ column, expanded = false }: { column: BoardColumnModel; expanded?: boolean }): string {
	return renderToStaticMarkup(<BoardColumn column={column} expanded={expanded} onToggle={() => undefined} onOpen={() => undefined} />);
}

const DONE: BoardColumnModel = { id: "done", name: "Done", total: 128, tasks: cards(128), cap: 5 };
const BACKLOG: BoardColumnModel = { id: "backlog", name: "Backlog", total: 12, tasks: cards(12), cap: 8 };

describe("BoardColumn", () => {
	it("is a labelled section whose header names the column and its total", () => {
		const html = render({ column: DONE });
		expect(html).toContain('<section class="av-col" aria-label="Done"><div class="av-col-h"><span>Done</span><span class="n">128</span></div>');
	});

	it("shows the 5 most recent of a 128-task Done column with Show all 128", () => {
		const html = render({ column: DONE });
		expect(html.match(/class="av-task"/g)).toHaveLength(5);
		expect(stripMarkup(html)).toContain("Showing the 5 most recent of 128");
		expect(html).toContain('<button type="button" class="av-btn ghost">Show all 128</button>');
	});

	it("shows every Done task once expanded, with the loaded count and Show recent only", () => {
		const html = render({ column: DONE, expanded: true });
		expect(html.match(/class="av-task"/g)).toHaveLength(128);
		expect(stripMarkup(html)).toContain("Showing loaded 128 of 128");
		expect(html).toContain('<button type="button" class="av-btn ghost">Show recent only</button>');
	});

	it("says how many more another column holds past its cap of 8", () => {
		const html = render({ column: BACKLOG });
		expect(html.match(/class="av-task"/g)).toHaveLength(8);
		expect(stripMarkup(html)).toContain("4 more in Backlog");
		expect(html).toContain('<button type="button" class="av-btn ghost">Show all 12</button>');
	});

	it("shows all of another column once expanded, with no line under it", () => {
		const html = render({ column: BACKLOG, expanded: true });
		expect(html.match(/class="av-task"/g)).toHaveLength(12);
		expect(html).not.toContain('class="more"');
	});

	it("has no line when everything fits under the cap", () => {
		expect(render({ column: { ...DONE, total: 5, tasks: cards(5) } })).not.toContain('class="more"');
		expect(render({ column: { ...BACKLOG, total: 3, tasks: cards(3) } })).not.toContain('class="more"');
	});
});
