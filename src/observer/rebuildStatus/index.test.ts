import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/service/observer/kanban/board/read/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/status/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/readLiveness/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/readArchive/index.js", () => ({ default: vi.fn() }));

import readArchive from "@/service/observer/event/readArchive/index.js";
import readLiveness from "@/service/observer/event/readLiveness/index.js";
import readBoard from "@/service/observer/kanban/board/read/index.js";
import boardHints from "@/service/observer/kanban/shared/boardHints/index.js";
import buildStatus from "@/service/observer/status/index.js";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession } from "../types/index.js";
import rebuildStatus from "./index.js";

const mockReadBoard = readBoard as ReturnType<typeof vi.fn>;
const mockBuildStatus = buildStatus as ReturnType<typeof vi.fn>;
const mockReadLiveness = readLiveness as ReturnType<typeof vi.fn>;
const mockReadArchive = readArchive as ReturnType<typeof vi.fn>;
const KEY = "p-aaaaaa";

function makeStarted({ sessionId, ts, kanbanTag }: { sessionId: string; ts: string; kanbanTag: string }): ObserverEvent {
	return { v: 1, ts, sessionId, seq: 1, pid: 1, kind: "session_started", kanbanTag };
}

function makePrompt({ sessionId, seq }: { sessionId: string; seq: number }): ObserverEvent {
	return { v: 1, ts: `2026-03-01T00:00:0${seq}.000Z`, sessionId, seq, pid: 1, kind: "prompt", text: `p${seq}` };
}

const unavailableBoard = { state: "unavailable", reason: "no-brain-config", detail: "none", hint: boardHints["no-brain-config"] };

describe("rebuildStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadBoard.mockResolvedValue(unavailableBoard);
		mockBuildStatus.mockResolvedValue({ marker: "status" });
		mockReadLiveness.mockResolvedValue({ sessions: {}, unlinked: [] });
		mockReadArchive.mockResolvedValue([]);
	});

	it("reads the board from the newest session's location with the kanban override", async () => {
		const sessions: HeldSession[] = [
			{ projectKey: "p-aaaaaa", sessionId: "old", events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", kanbanTag: "old" })] },
			{ projectKey: "p-aaaaaa", sessionId: "new", events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z", kanbanTag: "new" })] },
		];

		await rebuildStatus({ projectKey: KEY, projectRoot: "/project", sessions, kanbanOverride: "/override" });

		expect(mockReadBoard).toHaveBeenCalledWith({
			reported: { kanbanTag: "new" },
			kanbanOverride: "/override",
			projectRoot: "/project",
		});
	});

	it("hands the builder the board and every event of every session", async () => {
		const first = makePrompt({ sessionId: "a", seq: 1 });
		const second = makePrompt({ sessionId: "b", seq: 2 });

		const result = await rebuildStatus({
			projectKey: KEY,
			projectRoot: "/project",
			sessions: [
				{ projectKey: "p-aaaaaa", sessionId: "a", events: [first] },
				{ projectKey: "p-aaaaaa", sessionId: "b", events: [second] },
			],
		});

		expect(mockBuildStatus).toHaveBeenCalledWith({
			projectRoot: "/project",
			events: [first, second],
			archivedEvents: [],
			liveness: {},
			board: unavailableBoard,
		});
		expect(result).toEqual({ marker: "status" });
	});

	it("still builds a status with an unavailable board when the board read throws", async () => {
		mockReadBoard.mockRejectedValue(new Error("disk gone"));

		await rebuildStatus({ projectKey: KEY, projectRoot: "/project", sessions: [] });

		expect(mockBuildStatus).toHaveBeenCalledWith({
			projectRoot: "/project",
			events: [],
			archivedEvents: [],
			liveness: {},
			board: { state: "unavailable", reason: "board-read-failed", detail: "board read failed: disk gone", hint: boardHints["board-read-failed"] },
		});
	});

	it("hands the builder each session's liveness read for this project and the archived sessions' events", async () => {
		const live = { state: "waiting", lastActivityAt: null, quietMinutes: 0, maybeStuck: false };
		const archivedEvent = makePrompt({ sessionId: "old", seq: 3 });
		const held = makePrompt({ sessionId: "a", seq: 1 });
		mockReadLiveness.mockResolvedValue({ sessions: { a: live }, unlinked: [] });
		mockReadArchive.mockResolvedValue([{ sessionId: "old", events: [archivedEvent] }]);
		const sessions: HeldSession[] = [{ projectKey: KEY, sessionId: "a", events: [held] }];

		await rebuildStatus({ projectKey: KEY, projectRoot: "/project", sessions });

		expect(mockReadLiveness).toHaveBeenCalledWith({ projectKey: KEY, sessions, now: expect.any(Number) });
		expect(mockReadArchive).toHaveBeenCalledWith({ projectKey: KEY });
		expect(mockBuildStatus).toHaveBeenCalledWith({
			projectRoot: "/project",
			events: [held],
			archivedEvents: [archivedEvent],
			liveness: { a: live },
			board: unavailableBoard,
		});
	});

	it("degrades a throwing liveness read to no liveness and a throwing archive read to no archived events", async () => {
		const held = makePrompt({ sessionId: "a", seq: 1 });
		mockReadLiveness.mockRejectedValue(new Error("presence gone"));
		mockReadArchive.mockRejectedValue(new Error("archive gone"));

		await rebuildStatus({ projectKey: KEY, projectRoot: "/project", sessions: [{ projectKey: KEY, sessionId: "a", events: [held] }] });

		expect(mockBuildStatus).toHaveBeenCalledWith({
			projectRoot: "/project",
			events: [held],
			archivedEvents: [],
			liveness: {},
			board: unavailableBoard,
		});
	});
});
