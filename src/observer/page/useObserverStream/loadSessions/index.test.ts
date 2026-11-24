import { afterEach, describe, expect, it, vi } from "vitest";
import fetchSessions from "@/observer/page/api/fetchSessions/index.js";
import loadSessions from "./index.js";

vi.mock("@/observer/page/api/fetchSessions/index.js", () => ({ default: vi.fn() }));

const session = { sessionId: "s1", startedAt: "2026-01-01T09:00:00.000Z", metadata: null, eventCount: 2, lastEventAt: null, live: false };

afterEach(() => {
	vi.restoreAllMocks();
});

describe("loadSessions", () => {
	it("dispatches the list as a sessions action for the project", async () => {
		vi.mocked(fetchSessions).mockResolvedValue({ ok: true, data: { sessions: [session] } });
		const dispatch = vi.fn();

		await loadSessions({ token: "t", projectKey: "p-123456", dispatch, isCancelled: () => false });

		expect(dispatch).toHaveBeenCalledWith({ name: "sessions", data: { projectKey: "p-123456", sessions: [session] } });
	});

	it("logs a failure and dispatches nothing", async () => {
		vi.mocked(fetchSessions).mockResolvedValue({ ok: false, status: 0, message: "The observer could not be reached." });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const dispatch = vi.fn();

		await loadSessions({ token: "t", projectKey: "p-123456", dispatch, isCancelled: () => false });

		expect(dispatch).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledOnce();
	});

	it("dispatches nothing once cancelled", async () => {
		vi.mocked(fetchSessions).mockResolvedValue({ ok: true, data: { sessions: [session] } });
		const dispatch = vi.fn();

		await loadSessions({ token: "t", projectKey: "p-123456", dispatch, isCancelled: () => true });

		expect(dispatch).not.toHaveBeenCalled();
	});
});
