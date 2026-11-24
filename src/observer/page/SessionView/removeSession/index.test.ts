import { afterEach, describe, expect, it, vi } from "vitest";
import deleteSession from "@/observer/page/api/deleteSession/index.js";
import removeSession from "./index.js";

vi.mock("@/observer/page/api/deleteSession/index.js", () => ({ default: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

describe("removeSession", () => {
	it("answers null and stays when another session is deleted", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: true, data: { deleted: "old" } });
		const navigate = vi.fn();

		const message = await removeSession({ token: "t", projectKey: "p", sessionId: "old", routeSessionId: "now", navigate });

		expect(message).toBeNull();
		expect(navigate).not.toHaveBeenCalled();
		expect(deleteSession).toHaveBeenCalledWith({ token: "t", projectKey: "p", sessionId: "old" });
	});

	it("goes Home with the token when the session the page names is deleted", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: true, data: { deleted: "now" } });
		const navigate = vi.fn();

		await removeSession({ token: "a b", projectKey: "p", sessionId: "now", routeSessionId: "now", navigate });

		expect(navigate).toHaveBeenCalledWith("/?token=a%20b");
	});

	it("answers the observer's message and stays when the delete is refused", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: false, status: 409, message: "That session is still live." });
		const navigate = vi.fn();

		const message = await removeSession({ token: "t", projectKey: "p", sessionId: "now", routeSessionId: "now", navigate });

		expect(message).toBe("That session is still live.");
		expect(navigate).not.toHaveBeenCalled();
	});

	it("stays put after a delete when the caller names no route session (Home)", async () => {
		vi.mocked(deleteSession).mockResolvedValue({ ok: true, data: { deleted: "old" } });
		const navigate = vi.fn();

		const message = await removeSession({ token: "t", projectKey: "p", sessionId: "old", navigate });

		expect(message).toBeNull();
		expect(navigate).not.toHaveBeenCalled();
	});
});
