import { describe, expect, it } from "vitest";
import { SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import type { FixtureEvent } from "@/observer/seedFixtures/types/index.js";
import timeline from "./index.js";

/** Whole seconds between two events of a cut (the older one first). */
function secondsBetween(from: FixtureEvent, to: FixtureEvent): number {
	return Math.round((from.offsetMin - to.offsetMin) * SECONDS_PER_MINUTE);
}

/** The first event of a cut that satisfies `match`. */
function find(events: FixtureEvent[], match: (event: FixtureEvent) => boolean): FixtureEvent {
	const found = events.find(match);
	if (!found) throw new Error("No such event in the cut");
	return found;
}

const phase = (kind: "phase_started" | "phase_finished", name: string) => (event: FixtureEvent) =>
	event.kind === kind && "phase" in event && event.phase === name;

describe("timeline", () => {
	const idle = timeline({ through: "idle", lastAgoMin: 40 });

	it.each([
		["spec", 2 * 60 + 10],
		["research", 6 * 60 + 2],
		["synthesize", 3 * 60 + 18],
		["plan", 3 * 60 + 41],
		["build", 18 * 60 + 20],
	])("runs %s for the duration the handoff's rail shows", (name, seconds) => {
		expect(secondsBetween(find(idle, phase("phase_started", name)), find(idle, phase("phase_finished", name)))).toBe(seconds);
	});

	it("waits 4m 12s on the plan gate and passes QA 2m 48s after it starts", () => {
		expect(secondsBetween(find(idle, (e) => e.kind === "gate_waiting"), find(idle, (e) => e.kind === "gate_resolved"))).toBe(252);
		expect(secondsBetween(find(idle, phase("phase_started", "qa")), find(idle, (e) => e.kind === "qa_verdict"))).toBe(168);
	});

	it("ends the fix cut on Fix round 2 after two QA verdicts, round 1 having run 3m 50s", () => {
		const fix = timeline({ through: "fix", lastAgoMin: 65 / 60 });

		expect(fix.at(-1)).toMatchObject({ kind: "phase_started", phase: "fix", offsetMin: 65 / 60 });
		expect(fix.filter((event) => event.kind === "qa_verdict").map((event) => ("open" in event ? event.open : null))).toEqual([5, 2]);
		expect(secondsBetween(find(fix, phase("phase_started", "fix")), find(fix, phase("phase_finished", "fix")))).toBe(230);
		expect(fix.find((event) => event.kind === "error")).toMatchObject({ agent: "aide-qa", module: "src/tools/score" });
	});

	it("leaves the live build 7m 55s old, with Build step 3 its last checked step", () => {
		const build = timeline({ through: "build", lastAgoMin: 4 / 60 });
		const started = find(build, phase("phase_started", "build"));

		expect(Math.round(started.offsetMin * SECONDS_PER_MINUTE)).toBe(7 * 60 + 55);
		expect(build.filter((event) => event.kind === "plan_step_checked").map((event) => ("step" in event ? event.step : ""))).toEqual(["1", "2", "3"]);
	});

	it("folds a file the handoff lists under a row right after that row", () => {
		const kinds = idle.map((event) => event.kind);
		const finishedSpec = kinds.findIndex((kind, index) => kind === "phase_finished" && idle[index] && "phase" in idle[index] && idle[index].phase === "spec");

		expect(kinds.slice(finishedSpec + 1, finishedSpec + 3)).toEqual(["file_written", "file_written"]);
	});

	it("gives every cut a non-increasing run of offsets that ends at the age asked for", () => {
		for (const through of ["none", "plan", "wait", "build", "idle", "fix"] as const) {
			const events = timeline({ through, lastAgoMin: 3 });
			const offsets = events.map((event) => event.offsetMin);

			expect(offsets, through).toEqual([...offsets].sort((a, b) => b - a));
			expect(offsets.at(-1), through).toBeCloseTo(3);
			expect(events[0]?.kind, through).toBe("session_started");
		}
	});
});
