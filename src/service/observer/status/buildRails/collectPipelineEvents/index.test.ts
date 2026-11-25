import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import collectPipelineEvents from "./index.js";

function makeEvent(
	kind: ObserverEvent["kind"],
	envelope: { sessionId?: string; seq?: number; ts?: string },
	fields: Record<string, unknown> = {},
): ObserverEvent {
	return { v: 2, ts: "2026-11-22T12:00:00.000Z", sessionId: "s1", seq: 1, pid: 1, kind, ...fields, ...envelope } as ObserverEvent;
}

const phase = (pipeline: string | undefined, envelope: { sessionId?: string; seq?: number; ts?: string }) =>
	makeEvent("phase_started", envelope, { phase: "spec", agent: "a", module: "src/a", ...(pipeline ? { pipeline } : {}) });

describe("collectPipelineEvents — with a pipeline", () => {
	it("gathers the pipeline's events from this session, other sessions and archived ones, ordered by ts, sessionId, seq", () => {
		const mine = [phase("p1", { seq: 2, ts: "2026-11-22T12:00:00.000Z" })];
		const others = [
			phase("p1", { sessionId: "old", seq: 1, ts: "2026-11-22T10:00:00.000Z" }),
			phase("p1", { sessionId: "a", seq: 9, ts: "2026-11-22T12:00:00.000Z" }),
		];

		const result = collectPipelineEvents({ sessionEvents: mine, otherEvents: others, pipeline: "p1" });

		expect(result.map((event) => `${event.sessionId}:${event.seq}`)).toEqual(["old:1", "a:9", "s1:2"]);
	});

	it("never includes another pipeline's events, nor an event naming none", () => {
		const mine = [phase("p2", { seq: 1 }), phase(undefined, { seq: 2 })];
		const others = [phase("p2", { sessionId: "x", seq: 1 })];

		expect(collectPipelineEvents({ sessionEvents: mine, otherEvents: others, pipeline: "p1" })).toEqual([]);
	});

	it("keeps this session's own commits but not another session's", () => {
		const mine = [makeEvent("commit", { seq: 3 }, { sha: "abcdef1" })];
		const others = [makeEvent("commit", { sessionId: "x", seq: 1 }, { sha: "abcdef2" })];

		const result = collectPipelineEvents({ sessionEvents: mine, otherEvents: others, pipeline: "p1" });

		expect(result.map((event) => event.sessionId)).toEqual(["s1"]);
	});
});

describe("collectPipelineEvents — without a pipeline", () => {
	it("takes only this session's phase-related events that name no pipeline", () => {
		const mine = [
			phase(undefined, { seq: 1 }),
			phase("p1", { seq: 2 }),
			makeEvent("prompt", { seq: 3 }, { text: "hi" }),
			makeEvent("commit", { seq: 4 }, { sha: "abcdef1" }),
		];
		const others = [phase(undefined, { sessionId: "x", seq: 1 })];

		const result = collectPipelineEvents({ sessionEvents: mine, otherEvents: others, pipeline: null });

		expect(result.map((event) => event.seq)).toEqual([1, 4]);
		expect(result.every((event) => event.sessionId === "s1")).toBe(true);
	});
});
