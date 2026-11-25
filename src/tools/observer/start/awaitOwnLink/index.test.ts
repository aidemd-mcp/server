import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockReadPresence } = vi.hoisted(() => ({ mockReadPresence: vi.fn() }));

vi.mock("@/service/observer/event/shared/readPresence/index.js", () => ({ default: mockReadPresence }));

import awaitOwnLink from "./index.js";

const OWN = "20261125T090000000Z-own000";

function makePresence(claudeSessionId: string, overrides: Record<string, unknown> = {}) {
	return {
		v: 1,
		claudeSessionId,
		state: "working",
		at: "2026-11-25T09:00:00.000Z",
		hookEvent: "PostToolUse",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("awaitOwnLink", () => {
	it("returns at once when no presence exists", async () => {
		mockReadPresence.mockResolvedValue([]);

		await awaitOwnLink({ projectKey: "p", sessionId: OWN });

		expect(mockReadPresence).toHaveBeenCalledTimes(1);
	});

	it("returns at once when a presence already links to the caller", async () => {
		mockReadPresence.mockResolvedValue([makePresence("claude-a"), makePresence("claude-b", { sessionId: OWN })]);

		await awaitOwnLink({ projectKey: "p", sessionId: OWN });

		expect(mockReadPresence).toHaveBeenCalledTimes(1);
	});

	it("returns at once when every unlinked presence is ended or linked to another session", async () => {
		mockReadPresence.mockResolvedValue([
			makePresence("claude-a", { state: "ended" }),
			makePresence("claude-b", { sessionId: "20261125T080000000Z-other0" }),
		]);

		await awaitOwnLink({ projectKey: "p", sessionId: OWN });

		expect(mockReadPresence).toHaveBeenCalledTimes(1);
	});

	it("polls every 100 ms and returns once the caller's link lands", async () => {
		mockReadPresence
			.mockResolvedValueOnce([makePresence("claude-a")])
			.mockResolvedValueOnce([makePresence("claude-a")])
			.mockResolvedValue([makePresence("claude-a", { sessionId: OWN })]);

		let done = false;
		const waiting = awaitOwnLink({ projectKey: "p", sessionId: OWN }).then(() => {
			done = true;
		});
		await vi.advanceTimersByTimeAsync(99);
		expect(done).toBe(false);
		await vi.advanceTimersByTimeAsync(101);
		await waiting;

		expect(mockReadPresence).toHaveBeenCalledTimes(3);
	});

	it("gives up after 1 000 ms when the link never lands, without throwing", async () => {
		mockReadPresence.mockResolvedValue([makePresence("claude-a")]);

		let done = false;
		const waiting = awaitOwnLink({ projectKey: "p", sessionId: OWN }).then(() => {
			done = true;
		});
		await vi.advanceTimersByTimeAsync(900);
		expect(done).toBe(false);
		await vi.advanceTimersByTimeAsync(200);
		await waiting;

		expect(done).toBe(true);
	});

	it("treats an unreadable presence folder as none and returns", async () => {
		mockReadPresence.mockRejectedValue(new Error("EACCES"));

		await expect(awaitOwnLink({ projectKey: "p", sessionId: OWN })).resolves.toBeUndefined();
	});
});
