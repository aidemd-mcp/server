import { afterEach, describe, expect, it, vi } from "vitest";
import deleteSession from "@/observer/page/api/deleteSession/index.js";
import removeSession from "./index.js";

vi.mock("@/observer/page/api/deleteSession/index.js", () => ({ default: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

describe("removeSession", () => {
	it("answers null when the archived session is deleted", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: true, data: { deleted: "old" } });

		expect(await removeSession({ token: "t", projectKey: "p", sessionId: "old" })).toBeNull();
		expect(deleteSession).toHaveBeenCalledWith({ token: "t", projectKey: "p", sessionId: "old" });
	});

	it("answers the observer's message when the delete is refused", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: false, status: 404, message: "Archived session old was not found." });

		expect(await removeSession({ token: "t", projectKey: "p", sessionId: "old" })).toBe("Archived session old was not found.");
	});
});
