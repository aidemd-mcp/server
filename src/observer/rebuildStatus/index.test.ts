import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/service/observer/kanban/board/read/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/status/index.js", () => ({ default: vi.fn() }));

import readBoard from "@/service/observer/kanban/board/read/index.js";
import { BOARD_HINT } from "@/service/observer/kanban/shared/locateBoard/index.js";
import buildStatus from "@/service/observer/status/index.js";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession } from "../types/index.js";
import rebuildStatus from "./index.js";

const mockReadBoard = readBoard as ReturnType<typeof vi.fn>;
const mockBuildStatus = buildStatus as ReturnType<typeof vi.fn>;

function makeStarted({ sessionId, ts, brainPath, kanbanTag }: { sessionId: string; ts: string; brainPath: string; kanbanTag: string }): ObserverEvent {
	return { v: 1, ts, sessionId, seq: 1, pid: 1, kind: "session_started", brainPath, kanbanTag };
}

function makePrompt({ sessionId, seq }: { sessionId: string; seq: number }): ObserverEvent {
	return { v: 1, ts: `2026-03-01T00:00:0${seq}.000Z`, sessionId, seq, pid: 1, kind: "prompt", text: `p${seq}` };
}

const unavailableBoard = { state: "unavailable", reason: "no-brain-path", detail: "none", hint: BOARD_HINT };

describe("rebuildStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadBoard.mockResolvedValue(unavailableBoard);
		mockBuildStatus.mockResolvedValue({ marker: "status" });
	});

	it("reads the board from the newest session's location with the brain override", async () => {
		const sessions: HeldSession[] = [
			{ projectKey: "p-aaaaaa", sessionId: "old", events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", brainPath: "/old", kanbanTag: "old" })] },
			{ projectKey: "p-aaaaaa", sessionId: "new", events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z", brainPath: "/new", kanbanTag: "new" })] },
		];

		await rebuildStatus({ projectRoot: "/project", sessions, brainOverride: "/override" });

		expect(mockReadBoard).toHaveBeenCalledWith({
			reported: { brainPath: "/new", kanbanTag: "new" },
			brainOverride: "/override",
			projectRoot: "/project",
		});
	});

	it("hands the builder the board and every event of every session", async () => {
		const first = makePrompt({ sessionId: "a", seq: 1 });
		const second = makePrompt({ sessionId: "b", seq: 2 });

		const result = await rebuildStatus({
			projectRoot: "/project",
			sessions: [
				{ projectKey: "p-aaaaaa", sessionId: "a", events: [first] },
				{ projectKey: "p-aaaaaa", sessionId: "b", events: [second] },
			],
		});

		expect(mockBuildStatus).toHaveBeenCalledWith({ projectRoot: "/project", events: [first, second], board: unavailableBoard });
		expect(result).toEqual({ marker: "status" });
	});

	it("still builds a status with an unavailable board when the board read throws", async () => {
		mockReadBoard.mockRejectedValue(new Error("disk gone"));

		await rebuildStatus({ projectRoot: "/project", sessions: [] });

		expect(mockBuildStatus).toHaveBeenCalledWith({
			projectRoot: "/project",
			events: [],
			board: { state: "unavailable", reason: "board-read-failed", detail: "board read failed: disk gone", hint: BOARD_HINT },
		});
	});
});
