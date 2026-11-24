import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import buildIdle from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();

const finished = makeEvent({ seq: 2, ts: at(14, 24), kind: "phase_finished", phase: "build", agent: "aide-implementor", module: "src/tools/score" });
const started = makeEvent({ seq: 1, ts: at(14, 10), kind: "phase_started", phase: "build", agent: "aide-implementor", module: "src/tools/score" });

describe("buildIdle", () => {
	it("says how long since the newest event and labels the card for it", () => {
		const card = buildIdle({ events: [started, finished], projectRoot: "/work/app", now: NOW });
		expect(card).toMatchObject({
			kind: "idle",
			state: "Idle — no events for 10m",
			icon: "idle",
			time: "10m",
			timeLabel: "since last event",
			sub: null,
			steps: null,
			hint: null,
		});
	});

	it("words the newest event as the history panel words it", () => {
		const card = buildIdle({ events: [started, finished], projectRoot: "/work/app", now: NOW });
		expect(card.title).toBe("Last: Build finished · 14m 00s");
		expect(card.titleMono).toBeNull();
	});

	it("prefixes `Wrote ` for a file event and hands its path on as the mono part", () => {
		const written = makeEvent({ seq: 3, ts: at(14, 30), kind: "file_written", path: "src/tools/score/index.ts", action: "updated" });
		const card = buildIdle({ events: [finished, written], projectRoot: "/work/app", now: NOW });
		expect(card.title).toBe("Last: Wrote src/tools/score/index.ts");
	});

	it("gives the module and agent of the newest phase event", () => {
		const card = buildIdle({ events: [started, finished], projectRoot: "/work/app", now: NOW });
		expect(card.parts).toEqual([
			{ label: "module", value: "src/tools/score", mono: true },
			{ label: "agent", value: "aide-implementor", mono: true },
		]);
	});

	it("has no parts when no phase event is held", () => {
		const commit = makeEvent({ seq: 1, ts: at(14, 30), kind: "commit", sha: "abcdef1234567" });
		const card = buildIdle({ events: [commit], projectRoot: "/work/app", now: NOW });
		expect(card.parts).toEqual([]);
		expect(card.title).toBe("Last: Commit");
		expect(card.titleMono).toBe("abcdef1");
	});

	it("throws when it is given no events", () => {
		expect(() => buildIdle({ events: [], projectRoot: "", now: NOW })).toThrow("buildIdle needs at least one event");
	});
});
