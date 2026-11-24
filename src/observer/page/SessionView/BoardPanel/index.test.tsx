import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BoardColumnId } from "@/types/index.js";
import type { BoardModel } from "@/observer/page/types/index.js";
import BoardPanel from "./index.js";

const COLUMNS: { id: BoardColumnId; name: string }[] = [
	{ id: "backlog", name: "Backlog" },
	{ id: "todo", name: "Todo" },
	{ id: "in-progress", name: "In Progress" },
	{ id: "in-review", name: "In Review" },
	{ id: "done", name: "Done" },
];

const BOARD: BoardModel = {
	kind: "board",
	countLine: "1 tasks · 1 linked to this session",
	columns: COLUMNS.map((column) => ({
		...column,
		total: column.id === "todo" ? 1 : 0,
		cap: column.id === "done" ? 5 : 8,
		tasks: column.id === "todo" ? [{ slug: "a", title: "A", priority: "p0" as const, type: "bug", linked: true, unreadable: null }] : [],
	})),
};

describe("BoardPanel", () => {
	it("draws the toolbar with the outline hint and the count line over five columns", () => {
		const html = renderToStaticMarkup(<BoardPanel board={BOARD} expanded={new Set()} onToggle={() => undefined} onOpen={() => undefined} />);
		expect(html).toContain('<div class="av-toolbar"><span class="t2">Tasks linked to this session are outlined.</span><span class="count">1 tasks · 1 linked to this session</span></div>');
		expect(html).toContain('<div class="av-board">');
		expect(html.match(/<section class="av-col"/g)).toHaveLength(5);
	});

	it("draws a failed board as the error notice with role=status, the reason and the read time", () => {
		const html = renderToStaticMarkup(
			<BoardPanel
				expanded={new Set()}
				onToggle={() => undefined}
				board={{
					kind: "unavailable",
					tone: "err",
					heading: "Board can't load right now",
					text: "The brain folder isn't reachable (/brain is not a folder that exists). Everything else on this page is live.",
					meta: "Read again on every new event and page load · last try 14:31:02",
				}}
				onOpen={() => undefined}
			/>,
		);
		expect(html).toContain('<div class="av-notice err" role="status"><span class="ic lg i-cloud-off" aria-hidden="true"></span>');
		expect(html).toContain("<h3>Board can&#x27;t load right now</h3>");
		expect(html).toContain("(/brain is not a folder that exists). Everything else on this page is live.</p>");
		expect(html).toContain('<p class="meta">Read again on every new event and page load · last try 14:31:02</p>');
		expect(html).not.toContain("av-board");
	});

	it("draws a board that was never located as a calm notice with no role and no meta line", () => {
		const html = renderToStaticMarkup(
			<BoardPanel board={{ kind: "unavailable", tone: "calm", heading: "Board unavailable", text: "No session has reported a brain folder. A hint.", meta: null }} expanded={new Set()} onToggle={() => undefined} onOpen={() => undefined} />,
		);
		expect(html).toContain('<div class="av-notice calm"><span class="ic lg i-folder-off" aria-hidden="true"></span>');
		expect(html).not.toContain("role=");
		expect(html).not.toContain('class="meta"');
	});

	it("draws the Done column expanded exactly when the caller's set holds it", () => {
		const done = Array.from({ length: 7 }, (_, index) => ({ slug: `d${index}`, title: `D${index}`, priority: "p1" as const, type: "task", linked: false, unreadable: null }));
		const board: BoardModel = { ...BOARD, columns: BOARD.columns.map((column) => (column.id === "done" ? { ...column, total: 7, tasks: done } : column)) };
		const capped = renderToStaticMarkup(<BoardPanel board={board} expanded={new Set()} onToggle={() => undefined} onOpen={() => undefined} />);
		const open = renderToStaticMarkup(<BoardPanel board={board} expanded={new Set<BoardColumnId>(["done"])} onToggle={() => undefined} onOpen={() => undefined} />);
		expect(capped).toContain("Show all 7");
		expect(open).toContain("Show recent only");
	});
});
