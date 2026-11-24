import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LaneCell, NowCardModel, RailCell } from "@/observer/page/types/index.js";
import NowSection from "./index.js";

const CARD: NowCardModel = {
	kind: "run",
	state: "Running",
	icon: "run",
	title: "Build",
	titleMono: null,
	sub: "step 4 of 9",
	parts: [{ label: "module", value: "src/tools/score", mono: true }],
	time: "7m 55s",
	timeLabel: "elapsed · started 14:22",
	steps: null,
	hint: null,
};

const PHASES: RailCell[] = [{ name: "Build", state: "run", meta: "Step 4 of 9", loop: null }];
const LANES: LaneCell[] = [{ name: "Structure", state: "done", meta: "Done" }];

describe("NowSection", () => {
	it("is one labelled section holding the card, then the rail wrap with the scroller and the lanes", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} />);
		expect(html.startsWith('<section class="av-now" aria-label="Now running"><div class="av-card run">')).toBe(true);
		const wrap = html.indexOf('<div class="av-rail-wrap">');
		expect(wrap).toBeGreaterThan(html.indexOf("av-card run"));
		expect(html.indexOf('class="av-rail-scroll"')).toBeGreaterThan(wrap);
		expect(html.indexOf('class="av-lanes"')).toBeGreaterThan(html.indexOf('class="av-rail-scroll"'));
		expect(html.endsWith("</div></section>")).toBe(true);
	});

	it("keeps the card's h1 as the only heading", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} />);
		expect(html.match(/<h\d/g)).toHaveLength(1);
	});
});
