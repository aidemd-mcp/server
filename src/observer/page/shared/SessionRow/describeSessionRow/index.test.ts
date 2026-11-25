import { describe, expect, it } from "vitest";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import describeSessionRow from "./index.js";

const NOW = new Date(2026, 10, 23, 15, 0, 0);

function makeRow(overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return {
		sessionId: "s1",
		startedAt: new Date(2026, 10, 23, 14, 2, 0).toISOString(),
		lastEventAt: new Date(2026, 10, 23, 14, 31, 40).toISOString(),
		eventCount: 42,
		liveness: makeLiveness({ now: NOW }),
		task: "aide_score ranks misaligned specs",
		label: null,
		...overrides,
	};
}

describe("describeSessionRow", () => {
	it("labels the start with its day and clock and spans start to last event", () => {
		const description = describeSessionRow({ row: makeRow(), now: NOW });
		expect(description.startLabel).toBe("Today 14:02");
		expect(description.duration).toBe("29m 40s");
		expect(description.task).toBe("aide_score ranks misaligned specs");
	});

	it("uses 0s when the session reported no last event, and passes a missing task through", () => {
		const description = describeSessionRow({ row: makeRow({ lastEventAt: null, task: null }), now: NOW });
		expect(description.duration).toBe("0s");
		expect(description.task).toBeNull();
	});

	it("says Yesterday for a start the day before now", () => {
		const startedAt = new Date(2026, 10, 22, 16, 40, 0).toISOString();
		expect(describeSessionRow({ row: makeRow({ startedAt, lastEventAt: startedAt }), now: NOW }).startLabel).toBe("Yesterday 16:40");
	});

	it.each([
		["working", 1, { className: "run", icon: "run", word: "Working" }, true, false],
		["waiting", 1, { className: "wait", icon: "wait", word: "Waiting on you" }, true, false],
		["working", 20, { className: "neutral", icon: "idle", word: "Quiet 20 min · maybe stuck" }, false, false],
		["ended", 90, { className: "neutral", icon: "power", word: "Ended" }, false, true],
	] as const)("%s, %i min quiet gets its badge, live and ended flags", (state, minutesQuiet, badge, live, ended) => {
		const description = describeSessionRow({ row: makeRow({ liveness: makeLiveness({ state, minutesQuiet, now: NOW }) }), now: NOW });
		expect(description.badge).toEqual(badge);
		expect(description.live).toBe(live);
		expect(description.ended).toBe(ended);
	});
});
