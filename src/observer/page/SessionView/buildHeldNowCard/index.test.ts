import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import buildHeldNowCard from "./index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");

function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; seq: number }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId: "s1", pid: 1, ...fields } as ObserverEvent;
}

describe("buildHeldNowCard", () => {
	it("is empty with no event held", () => {
		expect(buildHeldNowCard({ events: [], focus: "s1", now: NOW })).toMatchObject({ kind: "empty", parts: [] });
	});

	it("is empty while only the opening and a prompt are held", () => {
		const events = [event({ kind: "session_started", seq: 1 }), event({ kind: "prompt", seq: 2, text: "go", ts: "2026-01-01T09:30:00.000Z" })];
		const card = buildHeldNowCard({ events, focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "empty", state: "No activity yet" });
		expect(card.parts).toHaveLength(1);
	});

	it("is idle once an event beyond the opening is held, with how long it has been quiet", () => {
		const events = [event({ kind: "session_started", seq: 1 }), event({ kind: "commit", seq: 2, sha: "abc1234", ts: "2026-01-01T09:30:00.000Z" })];
		expect(buildHeldNowCard({ events, focus: "s1", now: NOW })).toMatchObject({
			kind: "idle",
			state: "Idle — no events for 30m",
			time: "30m",
			timeLabel: "since last event",
			parts: [],
		});
	});

	it("reads the module and agent of the newest phase event on the idle card", () => {
		const events = [
			event({ kind: "phase_started", seq: 1, phase: "qa", agent: "aide-qa", module: "src/a", ts: "2026-01-01T09:00:00.000Z" }),
			event({ kind: "phase_finished", seq: 2, phase: "qa", agent: "aide-qa", module: "src/a", ts: "2026-01-01T09:10:00.000Z" }),
		];
		expect(buildHeldNowCard({ events, focus: "s1", now: NOW }).parts).toEqual([
			{ label: "module", value: "src/a", mono: true },
			{ label: "agent", value: "aide-qa", mono: true },
		]);
	});

	it("is a run card, without a step bar, for a phase the focused session started and has not finished", () => {
		const events = [
			event({ kind: "phase_started", seq: 1, phase: "build", agent: "aide-implementor", module: "src/a", ts: "2026-01-01T09:55:00.000Z" }),
			event({ kind: "phase_finished", seq: 2, phase: "plan", agent: "aide-architect", module: "src/a", ts: "2026-01-01T09:56:00.000Z" }),
		];
		const card = buildHeldNowCard({ events, focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "run", state: "Running", title: "Build", sub: null, steps: null, time: "5m 00s" });
		expect(card.parts).toEqual([
			{ label: "agent", value: "aide-implementor", mono: true },
			{ label: "module", value: "src/a", mono: true },
		]);
	});

	it("is not running once the phase finished, and ignores another session's open phase", () => {
		const closed = [
			event({ kind: "phase_started", seq: 1, phase: "spec", agent: "a", module: "m" }),
			event({ kind: "phase_finished", seq: 2, phase: "spec", agent: "a", module: "m" }),
			event({ kind: "phase_started", seq: 1, phase: "build", agent: "b", module: "n", sessionId: "s2" }),
		];
		expect(buildHeldNowCard({ events: closed, focus: "s1", now: NOW }).kind).toBe("idle");
		expect(buildHeldNowCard({ events: closed, focus: "s2", now: NOW }).kind).toBe("run");
	});
});
