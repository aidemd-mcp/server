import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/util/isProcessRunning/index.js", () => ({
	default: vi.fn(),
}));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import SESSION_IDLE_LIMIT_MS from "@/util/sessionIdleLimit/index.js";
import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const mockIsProcessRunning = isProcessRunning as ReturnType<typeof vi.fn>;

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

function makeEvent(overrides: Partial<ObserverEvent> = {}): ObserverEvent {
	return {
		v: 1,
		ts: new Date(NOW).toISOString(),
		sessionId: "20261122T090000000Z-aaaaaa",
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
		...overrides,
	} as ObserverEvent;
}

function minutesBefore(minutes: number): string {
	return new Date(NOW - minutes * MINUTE).toISOString();
}

function msBefore(ms: number): string {
	return new Date(NOW - ms).toISOString();
}

describe("judgeLiveness", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsProcessRunning.mockReturnValue(false);
	});

	it("is false with no events", () => {
		expect(judgeLiveness({ events: [], now: NOW })).toBe(false);
	});

	it("is true when the pid is running, however old the last event", () => {
		mockIsProcessRunning.mockReturnValue(true);
		const events = [makeEvent({ ts: minutesBefore(2 * 24 * 60) })];

		expect(judgeLiveness({ events, now: NOW })).toBe(true);
		expect(mockIsProcessRunning).toHaveBeenCalledWith(4242);
	});

	it("is true when the pid is gone but the last event is a minute inside the idle limit", () => {
		const events = [makeEvent({ ts: msBefore(SESSION_IDLE_LIMIT_MS - MINUTE) })];

		expect(judgeLiveness({ events, now: NOW })).toBe(true);
	});

	it("is false when the pid is gone and the last event is exactly at the idle limit", () => {
		const events = [makeEvent({ ts: msBefore(SESSION_IDLE_LIMIT_MS) })];

		expect(judgeLiveness({ events, now: NOW })).toBe(false);
	});

	it("is false when the pid is gone and the last event is a minute past the idle limit", () => {
		const events = [makeEvent({ ts: msBefore(SESSION_IDLE_LIMIT_MS + MINUTE) })];

		expect(judgeLiveness({ events, now: NOW })).toBe(false);
	});

	it("lets the highest-seq event decide even when it is not last in the array", () => {
		const events = [
			makeEvent({ seq: 3, ts: minutesBefore(1), pid: 3003 }),
			makeEvent({ seq: 1, ts: minutesBefore(600), pid: 1001 }),
			makeEvent({ seq: 2, ts: minutesBefore(600), pid: 2002 }),
		];

		expect(judgeLiveness({ events, now: NOW })).toBe(true);
		expect(mockIsProcessRunning).toHaveBeenCalledWith(3003);
		expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);
	});

	it("is false when the highest-seq event is the old one, even if an earlier event is recent", () => {
		const events = [
			makeEvent({ seq: 5, ts: minutesBefore(600) }),
			makeEvent({ seq: 2, ts: minutesBefore(1) }),
		];

		expect(judgeLiveness({ events, now: NOW })).toBe(false);
	});
});
