import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import NowCard from "./index.js";

const BASE: NowCardModel = {
	kind: "run",
	state: "Running",
	icon: "run",
	title: "Build",
	titleMono: null,
	sub: "step 4 of 9",
	parts: [
		{ label: "agent", value: "aide-implementor", mono: true },
		{ label: "module", value: "src/tools/score", mono: true },
	],
	time: "7m 55s",
	timeLabel: "elapsed · started 14:22",
	steps: { total: 9, done: 3, running: 1, head: "Step 4 of 9", text: "Wire weights into the ranking" },
	hint: null,
};

const WAIT: NowCardModel = {
	kind: "wait",
	state: "Waiting on you",
	icon: "wait",
	title: "Approve",
	titleMono: "plan.aide",
	sub: null,
	parts: [
		{ label: "for", value: "src/tools/score", mono: true },
		{ label: "written by", value: "aide-architect", mono: true },
	],
	time: "2m",
	timeLabel: "waiting since 14:18",
	steps: null,
	hint: "The agent is paused until you answer in its session. This page is read-only.",
};

const IDLE: NowCardModel = {
	kind: "idle",
	state: "Idle — no events for 12m",
	icon: "idle",
	title: "Last: QA passed",
	titleMono: null,
	sub: null,
	parts: [{ label: "module", value: "src/tools/score", mono: true }],
	time: "12m",
	timeLabel: "since last event",
	steps: null,
	hint: null,
};

const EMPTY: NowCardModel = {
	kind: "empty",
	state: "No activity yet",
	icon: "clock",
	title: "Waiting for the first phase",
	titleMono: null,
	sub: null,
	parts: [{ label: "session started", value: "14:02", mono: true }],
	time: null,
	timeLabel: null,
	steps: null,
	hint: "The agent hasn’t started a phase. The rail and this card light up as soon as one begins.",
};

describe("NowCard", () => {
	it.each([
		["run", BASE, "ic lg i-run"],
		["wait", WAIT, "ic lg i-wait"],
		["fix", { ...BASE, kind: "fix", icon: "loop" } as NowCardModel, "ic lg i-loop"],
		["idle", IDLE, "ic lg i-idle"],
		["empty", EMPTY, "ic lg i-clock"],
	] as const)("a %s card carries its class and its state's glyph", (kind, card, icon) => {
		const html = renderToStaticMarkup(<NowCard card={card} />);
		expect(html).toContain(`<div class="av-card ${kind}">`);
		expect(html).toContain(`<span class="${icon}" aria-hidden="true"></span>`);
		expect(html).toContain(`<div class="c-state">`);
	});

	it("draws the phase as the h1 with the step beside it, and the parts with mono values", () => {
		const html = renderToStaticMarkup(<NowCard card={BASE} />);
		expect(html).toContain('<h1 class="c-title"><span>Build</span><span class="sub">step 4 of 9</span></h1>');
		expect(html).toContain('<span><span class="lbl">agent</span><span class="mono">aide-implementor</span></span>');
		expect(html).toContain('<span><span class="lbl">module</span><span class="mono">src/tools/score</span></span>');
	});

	it("sets the waiting file's name in mono after the title", () => {
		const html = renderToStaticMarkup(<NowCard card={WAIT} />);
		expect(html).toContain('<span class="mono">plan.aide</span>');
		expect(stripMarkup(html)).toContain("Approve plan.aide");
		expect(html).toContain('<p class="c-hint">The agent is paused until you answer in its session. This page is read-only.</p>');
	});

	it("hides the ticking time from assistive technology and leaves a static label in its place", () => {
		const html = renderToStaticMarkup(<NowCard card={BASE} />);
		expect(html).toContain('<span class="big" aria-hidden="true">7m 55s</span>');
		expect(html).toContain('<span class="sr">elapsed · started 14:22</span>');
		expect(html).not.toContain('aria-live');
		expect(html).not.toContain('role="status"');
	});

	it("shows the step block with its head, words and bar only when the card has steps", () => {
		const html = renderToStaticMarkup(<NowCard card={BASE} />);
		expect(html).toContain('<div class="c-steps"><div class="row wrap" style="gap:4px 10px"><b>Step 4 of 9</b><span class="t2">Wire weights into the ranking</span></div>');
		expect(html).toContain('role="img" aria-label="Step 4 of 9"');
		expect(renderToStaticMarkup(<NowCard card={WAIT} />)).not.toContain("c-steps");
	});

	it("leaves out the words line while the step's text is not loaded", () => {
		const html = renderToStaticMarkup(<NowCard card={{ ...BASE, steps: { ...BASE.steps!, text: null } }} />);
		expect(html).toContain("<b>Step 4 of 9</b></div>");
		expect(html).not.toContain('class="t2"');
	});

	it("draws no time block on the empty card and no hint when there is none", () => {
		const empty = renderToStaticMarkup(<NowCard card={EMPTY} />);
		expect(empty).not.toContain("c-time");
		expect(empty).toContain("The agent hasn’t started a phase.");
		expect(renderToStaticMarkup(<NowCard card={IDLE} />)).not.toContain("c-hint");
	});

	it("offers no approve or reject control", () => {
		for (const card of [BASE, WAIT, IDLE, EMPTY]) expect(renderToStaticMarkup(<NowCard card={card} />)).not.toContain("<button");
	});
});
