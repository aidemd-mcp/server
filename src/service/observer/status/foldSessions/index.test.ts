import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/util/isProcessRunning/index.js", () => ({
	default: vi.fn(),
}));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import type { ObserverEvent } from "@/types/index.js";
import SESSION_IDLE_LIMIT_MS from "@/util/sessionIdleLimit/index.js";
import foldSessions from "./index.js";

const mockIsProcessRunning = isProcessRunning as ReturnType<typeof vi.fn>;

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

function iso(msBeforeNow: number): string {
	return new Date(NOW - msBeforeNow).toISOString();
}

function makeEvent(
	fields: { kind: "session_started" | "prompt" } & Record<string, unknown>,
	envelope: { sessionId?: string; seq?: number; ts?: string; pid?: number } = {},
): ObserverEvent {
	const base = {
		v: 1,
		ts: iso(0),
		sessionId: "s1",
		seq: 1,
		pid: 100,
		...envelope,
	};
	if (fields.kind === "prompt") return { ...base, text: "hi", ...fields } as ObserverEvent;
	return { ...base, ...fields } as ObserverEvent;
}

describe("foldSessions — liveness", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsProcessRunning.mockReturnValue(false);
	});

	it("is live when the last event is 29 minutes old, even with a dead pid", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(29 * MINUTE) })];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.liveness).toBe("live");
	});

	it("is ended at exactly 30 minutes with a dead pid", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(SESSION_IDLE_LIMIT_MS) })];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.liveness).toBe("ended");
	});

	it("is idle when 2 hours old and the pid is running", () => {
		mockIsProcessRunning.mockReturnValue(true);
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(120 * MINUTE) })];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.liveness).toBe("idle");
	});

	it("is ended when 2 hours old and the pid is dead", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(120 * MINUTE) })];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.liveness).toBe("ended");
	});

	it("checks the pid of the highest-seq event", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { seq: 2, pid: 222, ts: iso(120 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { seq: 1, pid: 111, ts: iso(180 * MINUTE) }),
		];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.pid).toBe(222);
		expect(mockIsProcessRunning).toHaveBeenCalledWith(222);
		expect(mockIsProcessRunning).not.toHaveBeenCalledWith(111);
	});

	it("does not probe the pid when the session is live", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(MINUTE) })];

		foldSessions({ events, now: NOW });

		expect(mockIsProcessRunning).not.toHaveBeenCalled();
	});
});

describe("foldSessions — folding", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsProcessRunning.mockReturnValue(false);
	});

	it("follows seq, not array order, for startedAt and lastEventAt", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { seq: 3, ts: iso(1 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { seq: 1, ts: iso(10 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { seq: 2, ts: iso(5 * MINUTE) }),
		];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.startedAt).toBe(iso(10 * MINUTE));
		expect(session.lastEventAt).toBe(iso(1 * MINUTE));
		expect(session.eventCount).toBe(3);
	});

	it("reports null when there is no session_started event", () => {
		const events = [makeEvent({ kind: "prompt" }, { ts: iso(MINUTE) })];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.reported).toBeNull();
	});

	it("reports only the keys the first session_started carries", () => {
		const events = [
			makeEvent(
				{ kind: "session_started", projectRoot: "/p", kanbanTag: "tag" },
				{ ts: iso(MINUTE) },
			),
		];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.reported).toEqual({ projectRoot: "/p", kanbanTag: "tag" });
		expect(session.reported).not.toHaveProperty("brainPath");
	});

	it("uses the first session_started when there are several", () => {
		const events = [
			makeEvent({ kind: "session_started", projectRoot: "/second" }, { seq: 2, ts: iso(MINUTE) }),
			makeEvent({ kind: "session_started", projectRoot: "/first" }, { seq: 1, ts: iso(2 * MINUTE) }),
		];

		const [session] = foldSessions({ events, now: NOW });

		expect(session.reported).toEqual({ projectRoot: "/first" });
	});

	it("orders sessions newest startedAt first", () => {
		const events = [
			makeEvent({ kind: "prompt" }, { sessionId: "old", ts: iso(10 * MINUTE) }),
			makeEvent({ kind: "prompt" }, { sessionId: "new", ts: iso(2 * MINUTE) }),
		];

		const sessions = foldSessions({ events, now: NOW });

		expect(sessions.map((session) => session.sessionId)).toEqual(["new", "old"]);
	});

	it("breaks startedAt ties by sessionId descending", () => {
		const ts = iso(MINUTE);
		const events = [
			makeEvent({ kind: "prompt" }, { sessionId: "a", ts }),
			makeEvent({ kind: "prompt" }, { sessionId: "c", ts }),
			makeEvent({ kind: "prompt" }, { sessionId: "b", ts }),
		];

		const sessions = foldSessions({ events, now: NOW });

		expect(sessions.map((session) => session.sessionId)).toEqual(["c", "b", "a"]);
	});

	it("returns nothing for no events", () => {
		expect(foldSessions({ events: [], now: NOW })).toEqual([]);
	});
});
