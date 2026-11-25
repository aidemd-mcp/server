import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/observer/event/readLiveness/index.js", () => ({
	default: vi.fn(),
}));

import readLiveness from "@/service/observer/event/readLiveness/index.js";
import attachLiveness from "./index.js";
import type { RawSessionLog, SessionLiveness } from "@/service/observer/event/types/index.js";

const mockReadLiveness = readLiveness as ReturnType<typeof vi.fn>;

const KEY = "demo-abcdef";
const FIRST = "20261122T090000000Z-aaaaaa";
const SECOND = "20261122T100000000Z-bbbbbb";

function makeLiveness(overrides: Partial<SessionLiveness> = {}): SessionLiveness {
	return { state: "working", lastActivityAt: null, quietMinutes: 0, maybeStuck: false, ...overrides };
}

function makeLog(sessionId: string, overrides: Partial<RawSessionLog> = {}): RawSessionLog {
	return { sessionId, started: null, events: [], skippedLines: 0, unreadable: false, ...overrides };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("attachLiveness", () => {
	it("asks readLiveness once for every log and gives each its own liveness", async () => {
		const ended = makeLiveness({ state: "ended", endedBy: "user" });
		mockReadLiveness.mockResolvedValue({ sessions: { [FIRST]: makeLiveness(), [SECOND]: ended }, unlinked: [] });

		const { sessions } = await attachLiveness({ projectKey: KEY, logs: [makeLog(FIRST), makeLog(SECOND)] });

		expect(mockReadLiveness).toHaveBeenCalledTimes(1);
		expect(sessions.map((session) => session.liveness)).toEqual([makeLiveness(), ended]);
	});

	it("passes an unreadable log with no events, like any session with none", async () => {
		mockReadLiveness.mockResolvedValue({ sessions: { [FIRST]: makeLiveness() }, unlinked: [] });

		await attachLiveness({ projectKey: KEY, logs: [makeLog(FIRST, { unreadable: true })] });

		expect(mockReadLiveness).toHaveBeenCalledWith({
			projectKey: KEY,
			sessions: [{ sessionId: FIRST, events: [] }],
			now: expect.any(Number),
		});
	});

	it("returns the unlinked presence readLiveness reported", async () => {
		const unlinked = [{ claudeSessionId: "c1111111", liveness: makeLiveness({ state: "ended", endedBy: "hook" }) }];
		mockReadLiveness.mockResolvedValue({ sessions: { [FIRST]: makeLiveness() }, unlinked });

		const result = await attachLiveness({ projectKey: KEY, logs: [makeLog(FIRST)] });

		expect(result.unlinked).toEqual(unlinked);
	});
});
