import { afterEach, describe, expect, it, vi } from "vitest";
import restoreSession from "@/observer/page/api/restoreSession/index.js";
import restoreFromArchive from "./index.js";

vi.mock("@/observer/page/api/restoreSession/index.js", () => ({ default: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

describe("restoreFromArchive", () => {
	it("answers null when the observer restores the session", async () => {
		vi.mocked(restoreSession).mockResolvedValue({ ok: true, data: { restored: "old" } });

		expect(await restoreFromArchive({ token: "t", projectKey: "p", sessionId: "old" })).toBeNull();
		expect(restoreSession).toHaveBeenCalledWith({ token: "t", projectKey: "p", sessionId: "old" });
	});

	it("answers the observer's message when the restore is refused", async () => {
		vi.mocked(restoreSession).mockResolvedValue({ ok: false, status: 409, message: "Already exists." });

		expect(await restoreFromArchive({ token: "t", projectKey: "p", sessionId: "old" })).toBe("Already exists.");
	});
});
