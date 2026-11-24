import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverEvent } from "@/types/index.js";

vi.mock("@/service/observer/event/shared/judgeLiveness/index.js", () => ({ default: vi.fn() }));

import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import summarizeSessions from "./index.js";

const mockLiveness = judgeLiveness as ReturnType<typeof vi.fn>;

function makeStarted(seq: number, extra: Record<string, string> = {}): ObserverEvent {
	return {
		v: 1,
		ts: `2026-01-01T00:00:0${seq}.000Z`,
		sessionId: "a",
		seq,
		pid: 1,
		kind: "session_started",
		...extra,
	} as ObserverEvent;
}

function makePrompt(seq: number): ObserverEvent {
	return { v: 1, ts: `2026-01-01T00:00:0${seq}.000Z`, sessionId: "a", seq, pid: 1, kind: "prompt", text: "x" };
}

describe("summarizeSessions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("summarizes a session with its session_started metadata and the liveness rule's answer", () => {
		mockLiveness.mockReturnValue(true);
		const events = [makeStarted(1, { projectRoot: "/p", kanbanTag: "t" }), makePrompt(2)];

		expect(summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events }], now: 99 })).toEqual([
			{
				sessionId: "a",
				startedAt: events[0]!.ts,
				metadata: { projectRoot: "/p", kanbanTag: "t" },
				eventCount: 2,
				lastEventAt: events[1]!.ts,
				live: true,
			},
		]);
		expect(mockLiveness).toHaveBeenCalledWith({ events, now: 99 });
	});

	it("falls back to the first event's ts and no metadata without a session_started", () => {
		mockLiveness.mockReturnValue(false);
		const events = [makePrompt(3), makePrompt(4)];

		const [listing] = summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events }], now: 0 });

		expect(listing).toMatchObject({ startedAt: events[0]!.ts, metadata: null, live: false });
	});

	it("gives null times for a session with no events", () => {
		mockLiveness.mockReturnValue(false);

		expect(summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [] }], now: 0 })).toEqual([
			{ sessionId: "a", startedAt: null, metadata: null, eventCount: 0, lastEventAt: null, live: false },
		]);
	});

	it("gives empty metadata when session_started carries no fields", () => {
		mockLiveness.mockReturnValue(false);

		const [listing] = summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [makeStarted(1)] }], now: 0 });

		expect(listing!.metadata).toEqual({});
	});
});
