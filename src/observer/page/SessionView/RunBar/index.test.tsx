import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import RunBar from "./index.js";

function makeCard(overrides: Partial<NowCardModel> = {}): NowCardModel {
	return {
		kind: "run",
		state: "Running",
		icon: "run",
		title: "Build",
		titleMono: null,
		sub: "step 4 of 9",
		parts: [
			{ label: "Agent", value: "aide-implementor", mono: true },
			{ label: "Module", value: "src/tools/score", mono: false },
		],
		time: "12m",
		timeLabel: "running for 12 minutes",
		steps: { total: 9, done: 3, running: 1, head: "Step 4 of 9", text: "Wire the tabs" },
		hint: null,
		...overrides,
	};
}

function render(card: NowCardModel): string {
	return renderToStaticMarkup(<RunBar card={card} />);
}

describe("RunBar", () => {
	it("prints the pipeline before the phase, and nothing extra without one", () => {
		expect(render(makeCard({ pipeline: "feature-x" }))).toContain('<span class="rb-title">feature-x · Build<span class="rb-sub"> step 4 of 9</span></span>');
		expect(render(makeCard({ pipeline: null }))).toContain('<span class="rb-title">Build<span');
	});

	it("reads Working outside the pipeline and No phase running as the state word", () => {
		expect(stripMarkup(render(makeCard({ kind: "idle", state: "Working outside the pipeline" })))).toContain("Working outside the pipeline");
		expect(stripMarkup(render(makeCard({ kind: "idle", state: "No phase running" })))).toContain("No phase running");
	});

	it("is one status row in the card's state colour", () => {
		expect(render(makeCard())).toContain('<div class="av-runbar run" role="status">');
		expect(render(makeCard({ kind: "idle" }))).toContain('<div class="av-runbar idle" role="status">');
	});

	it("reads the state word and glyph, the phase and its sub line", () => {
		const html = render(makeCard());
		expect(html).toContain('<span class="rb-state"><span class="ic i-run" aria-hidden="true"></span>Running</span>');
		expect(html).toContain('<span class="rb-title">Build<span class="rb-sub"> step 4 of 9</span></span>');
	});

	it("draws each labelled part, in monospace where the card says so", () => {
		const html = render(makeCard());
		expect(html).toContain('<span class="rb-part"><span class="lbl">Agent</span><span class="mono">aide-implementor</span></span>');
		expect(html).toContain('<span class="rb-part"><span class="lbl">Module</span><span>src/tools/score</span></span>');
	});

	it("draws the current step's words with the compact step bar, the words also its title", () => {
		const html = render(makeCard());
		expect(html).toContain('<span class="rb-steps" title="Wire the tabs"><span class="rb-step-text">Wire the tabs</span>');
		expect(html).toContain('role="img" aria-label="Step 4 of 9"');
		expect(html.match(/<i/g)).toHaveLength(9);
	});

	it("draws the step bar without words while the step's text has not loaded", () => {
		const html = render(makeCard({ steps: { total: 9, done: 3, running: 1, head: "Step 4 of 9", text: null } }));
		expect(html).not.toContain("rb-step-text");
		expect(html).toContain('<span class="rb-steps">');
	});

	it("puts the elapsed time on the right, hidden from assistive technology, with its label standing in", () => {
		const html = render(makeCard());
		expect(html).toContain('<span class="rb-time"><span class="mono" aria-hidden="true">12m</span><span class="sr">running for 12 minutes</span></span>');
	});

	it("draws a mono title part after the title, and leaves out what the card does not have", () => {
		const html = render(makeCard({ titleMono: "src/a/plan.aide", sub: null, parts: [], steps: null, time: null, timeLabel: null }));
		expect(html).toContain('Build<span class="mono"> src/a/plan.aide</span>');
		expect(stripMarkup(html)).toBe("RunningBuild src/a/plan.aide");
		expect(html).not.toContain("rb-sub");
		expect(html).not.toContain("rb-part");
		expect(html).not.toContain("rb-steps");
		expect(html).not.toContain("rb-time");
	});
});
