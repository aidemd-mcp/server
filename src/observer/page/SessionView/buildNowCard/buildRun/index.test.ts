import { describe, expect, it } from "vitest";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import buildRun from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const STARTED = new Date(2026, 10, 23, 14, 20, 0).toISOString();

describe("buildRun", () => {
	it("is the blue running card with the phase, agent, module and the time it has run", () => {
		const card = buildRun({ work: makeWork({ phase: "qa", agent: "aide-qa", module: "src/crawl", startedAt: STARTED }), elapsed: "14m 00s", stepText: null, now: NOW });
		expect(card).toMatchObject({ kind: "run", state: "Running", icon: "run", title: "QA", titleMono: null, time: "14m 00s", hint: null });
		expect(card.parts).toEqual([
			{ label: "agent", value: "aide-qa", mono: true },
			{ label: "module", value: "src/crawl", mono: true },
		]);
		expect(card.timeLabel).toBe("elapsed · started 14:20");
	});

	it("has no step line or bar for a phase other than Build", () => {
		const card = buildRun({ work: makeWork({ phase: "plan", buildStep: { reached: 3, total: 9 } }), elapsed: "1s", stepText: "ignored", now: NOW });
		expect(card.sub).toBeNull();
		expect(card.steps).toBeNull();
	});

	it("has no step line or bar for a Build with no reported step", () => {
		const card = buildRun({ work: makeWork({ phase: "build" }), elapsed: "1s", stepText: null, now: NOW });
		expect(card.sub).toBeNull();
		expect(card.steps).toBeNull();
	});

	it("adds `step n of m` and the step bar to a Build: earlier steps done, the reached one running", () => {
		const card = buildRun({ work: makeWork({ phase: "build", startedAt: STARTED, buildStep: { reached: 4, total: 9 } }), elapsed: "1s", stepText: "Types and routes", now: NOW });
		expect(card.sub).toBe("step 4 of 9");
		expect(card.steps).toEqual({ total: 9, done: 3, running: 1, head: "Step 4 of 9", text: "Types and routes" });
	});

	it("leaves the step's own words null until they are loaded", () => {
		const card = buildRun({ work: makeWork({ phase: "build", buildStep: { reached: 1, total: 2 } }), elapsed: "1s", stepText: null, now: NOW });
		expect(card.steps).toMatchObject({ done: 0, text: null });
	});
});
