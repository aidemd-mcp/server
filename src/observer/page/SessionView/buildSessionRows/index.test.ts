import { describe, expect, it } from "vitest";
import type { SessionListing } from "@/observer/types/index.js";
import type { ObserverEvent, SessionSummary } from "@/types/index.js";
import buildSessionRows from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

function summary({ sessionId, startedAt, liveness }: { sessionId: string; startedAt: string; liveness: SessionSummary["liveness"] }): SessionSummary {
	return { sessionId, startedAt, lastEventAt: startedAt, eventCount: 3, pid: 1, liveness, reported: null };
}

function taskEvent({ sessionId, seq, slug, title }: { sessionId: string; seq: number; slug: string; title?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T00:00:00.000Z", sessionId, seq, pid: 1, kind: "task", slug, title, action: "picked" } as ObserverEvent;
}

describe("buildSessionRows", () => {
	it("builds rows from the status summaries, newest first, with the liveness each carries", () => {
		const rows = buildSessionRows({
			summaries: [
				summary({ sessionId: "old", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
				summary({ sessionId: "new", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness({ minutesQuiet: 20 }) }),
			],
			held: [],
		});
		expect(rows.map((row) => [row.sessionId, row.liveness.state, row.liveness.maybeStuck, row.eventCount])).toEqual([
			["new", "working", true, 3],
			["old", "ended", false, 3],
		]);
	});

	it("builds rows from the listings when no status is ready: each row carries the listing's liveness", () => {
		const listings: SessionListing[] = [
			{ sessionId: "a", startedAt: "2026-01-01T08:00:00.000Z", metadata: null, eventCount: 2, lastEventAt: "2026-01-01T08:05:00.000Z", liveness: makeLiveness({ state: "ended" }) },
			{ sessionId: "b", startedAt: "2026-01-01T09:00:00.000Z", metadata: null, eventCount: 1, lastEventAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() },
			{ sessionId: "empty", startedAt: null, metadata: null, eventCount: 0, lastEventAt: null, liveness: makeLiveness({ state: "ended" }) },
		];
		const rows = buildSessionRows({ listings, held: [] });
		expect(rows.map((row) => [row.sessionId, row.liveness.state])).toEqual([
			["b", "working"],
			["a", "ended"],
		]);
	});

	it("prefers summaries over listings and yields nothing without either", () => {
		expect(buildSessionRows({ held: [] })).toEqual([]);
		const rows = buildSessionRows({
			summaries: [summary({ sessionId: "s", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() })],
			listings: [],
			held: [],
		});
		expect(rows).toHaveLength(1);
	});

	it("takes the task from the newest task event: its title, else its slug, else null", () => {
		const rows = buildSessionRows({
			summaries: [
				summary({ sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
				summary({ sessionId: "s2", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
				summary({ sessionId: "s3", startedAt: "2026-01-01T07:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
			],
			held: [
				{ sessionId: "s1", events: [taskEvent({ sessionId: "s1", seq: 1, slug: "first", title: "First" }), taskEvent({ sessionId: "s1", seq: 4, slug: "second", title: "Second" })] },
				{ sessionId: "s2", events: [taskEvent({ sessionId: "s2", seq: 2, slug: "only-slug" })] },
			],
		});
		expect(rows.map((row) => row.task)).toEqual(["Second", "only-slug", null]);
		expect(rows.map((row) => row.taskSlug)).toEqual(["second", "only-slug", null]);
	});

	it("labels live and idle rows S1, S2 in start order only when there are two or more", () => {
		const two = buildSessionRows({
			summaries: [
				summary({ sessionId: "b", startedAt: "2026-01-01T10:00:00.000Z", liveness: makeLiveness() }),
				summary({ sessionId: "a", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness({ minutesQuiet: 20 }) }),
				summary({ sessionId: "z", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
			],
			held: [],
		});
		expect(two.map((row) => [row.sessionId, row.label])).toEqual([
			["b", "S2"],
			["a", "S1"],
			["z", null],
		]);

		const one = buildSessionRows({
			summaries: [
				summary({ sessionId: "a", startedAt: "2026-01-01T09:00:00.000Z", liveness: makeLiveness() }),
				summary({ sessionId: "z", startedAt: "2026-01-01T08:00:00.000Z", liveness: makeLiveness({ state: "ended" }) }),
			],
			held: [],
		});
		expect(one.every((row) => row.label === null)).toBe(true);
	});
});
