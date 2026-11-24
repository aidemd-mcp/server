import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import buildEmpty from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();

const started = (sessionId: string, seq: number, ts: string) => makeEvent({ seq, ts, sessionId, kind: "session_started", projectRoot: "/work/app" });

describe("buildEmpty", () => {
	it("says no phase has started and has no time, steps or timer label", () => {
		const card = buildEmpty({ events: [], focus: "s1", now: NOW });
		expect(card).toMatchObject({
			kind: "empty",
			state: "No activity yet",
			icon: "clock",
			title: "Waiting for the first phase",
			sub: null,
			time: null,
			timeLabel: null,
			steps: null,
		});
		expect(card.hint).toContain("hasn’t started a phase");
	});

	it("has no part when no session_started event is held", () => {
		expect(buildEmpty({ events: [], focus: "s1", now: NOW }).parts).toEqual([]);
	});

	it("names when the focused session started", () => {
		const events = [started("s2", 1, at(9, 0)), started("s1", 1, at(10, 15))];
		expect(buildEmpty({ events, focus: "s1", now: NOW }).parts).toEqual([{ label: "session started", value: "10:15", mono: true }]);
	});

	it("falls back to the first session_started held when the focus has none", () => {
		const events = [started("s2", 1, at(9, 0)), started("s3", 1, at(10, 15))];
		expect(buildEmpty({ events, focus: "s1", now: NOW }).parts[0].value).toBe("09:00");
		expect(buildEmpty({ events, focus: null, now: NOW }).parts[0].value).toBe("09:00");
	});
});
