import { describe, expect, it } from "vitest";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";
import describeLiveness from "./index.js";

const NOW = new Date(2026, 10, 25, 12, 0, 0);

describe("describeLiveness", () => {
	it("reads a working session as Working", () => {
		expect(describeLiveness({ liveness: makeLiveness({ state: "working", minutesQuiet: 1, now: NOW }), now: NOW })).toEqual({
			word: "Working",
			className: "run",
			icon: "run",
			stuck: false,
		});
	});

	it("reads a waiting session as Waiting on you", () => {
		expect(describeLiveness({ liveness: makeLiveness({ state: "waiting", minutesQuiet: 2, now: NOW }), now: NOW })).toEqual({
			word: "Waiting on you",
			className: "wait",
			icon: "wait",
			stuck: false,
		});
	});

	it("reads an ended session as Ended, however long ago it was active", () => {
		expect(describeLiveness({ liveness: makeLiveness({ state: "ended", minutesQuiet: 600, now: NOW }), now: NOW })).toEqual({
			word: "Ended",
			className: "neutral",
			icon: "power",
			stuck: false,
		});
	});

	it.each(["working", "waiting"] as const)("reads a %s session 20 minutes quiet as maybe stuck", (state) => {
		expect(describeLiveness({ liveness: makeLiveness({ state, minutesQuiet: 20, now: NOW }), now: NOW })).toEqual({
			word: "Quiet 20 min · maybe stuck",
			className: "neutral",
			icon: "idle",
			stuck: true,
		});
	});

	it("is not stuck at exactly the limit, and is one minute past it", () => {
		expect(describeLiveness({ liveness: makeLiveness({ minutesQuiet: 15, now: NOW }), now: NOW }).stuck).toBe(false);
		expect(describeLiveness({ liveness: makeLiveness({ minutesQuiet: 16, now: NOW }), now: NOW }).word).toBe("Quiet 16 min · maybe stuck");
	});

	it("counts the quiet minutes forward with the clock without a new liveness", () => {
		const liveness = makeLiveness({ minutesQuiet: 20, now: NOW });
		const later = new Date(NOW.getTime() + 5 * 60 * 1000);
		expect(describeLiveness({ liveness, now: NOW }).word).toBe("Quiet 20 min · maybe stuck");
		expect(describeLiveness({ liveness, now: later }).word).toBe("Quiet 25 min · maybe stuck");
	});

	it("turns a fresh working session stuck as the clock passes the limit", () => {
		const liveness = makeLiveness({ minutesQuiet: 10, now: NOW });
		const later = new Date(NOW.getTime() + 10 * 60 * 1000);
		expect(describeLiveness({ liveness, now: NOW }).word).toBe("Working");
		expect(describeLiveness({ liveness, now: later }).word).toBe("Quiet 20 min · maybe stuck");
	});

	it("never re-derives the state: a recorded waiting stays waiting however fresh", () => {
		expect(describeLiveness({ liveness: makeLiveness({ state: "waiting", now: NOW }), now: NOW }).word).toBe("Waiting on you");
	});

	it("reads a session with no activity time as not quiet", () => {
		const liveness = { state: "working" as const, lastActivityAt: null, quietMinutes: 0, maybeStuck: false };
		expect(describeLiveness({ liveness, now: NOW }).word).toBe("Working");
	});
});
