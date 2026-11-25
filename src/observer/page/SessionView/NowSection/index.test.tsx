import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LaneCell, NowCardModel, RailCell, SessionModel } from "@/observer/page/types/index.js";
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
const RAIL: SessionModel["rail"] = { pipeline: "feature-x", outside: false, hidden: false };
const HIDDEN: SessionModel["rail"] = { pipeline: null, outside: false, hidden: true };

describe("NowSection", () => {
	it("is one labelled section holding the card, then the rail wrap with the scroller and the lanes", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} rail={RAIL} />);
		expect(html.startsWith('<section class="av-now" aria-label="Now running"><div class="av-card run">')).toBe(true);
		const wrap = html.indexOf('<div class="av-rail-wrap">');
		expect(wrap).toBeGreaterThan(html.indexOf("av-card run"));
		expect(html.indexOf('class="av-rail-scroll"')).toBeGreaterThan(wrap);
		expect(html.indexOf('class="av-lanes"')).toBeGreaterThan(html.indexOf('class="av-rail-scroll"'));
		expect(html.endsWith("</div></section>")).toBe(true);
	});

	it("names the pipeline in the rail's footer and draws it inside the rail wrap", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} rail={RAIL} />);
		expect(html.indexOf("Pipeline feature-x")).toBeGreaterThan(html.indexOf('<div class="av-rail-wrap">'));
	});

	it("draws the card alone, with no rail wrap, no phases and no lanes, when the session has no rail", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} rail={HIDDEN} />);
		expect(html).toContain("av-card run");
		expect(html).not.toContain("av-rail");
		expect(html).not.toContain("av-lanes");
	});

	it("keeps the card's h1 as the only heading", () => {
		const html = renderToStaticMarkup(<NowSection card={CARD} phases={PHASES} lanes={LANES} rail={RAIL} />);
		expect(html.match(/<h\d/g)).toHaveLength(1);
	});
});
