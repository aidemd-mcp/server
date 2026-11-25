import { afterEach, describe, expect, it, vi } from "vitest";
import archiveSession from "@/observer/page/api/archiveSession/index.js";
import sendToArchive from "./index.js";

vi.mock("@/observer/page/api/archiveSession/index.js", () => ({ default: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
});

describe("sendToArchive", () => {
	it("answers null and stays when another session is archived", async () => {
		vi.mocked(archiveSession).mockResolvedValue({ ok: true, data: { archived: "old" } });
		const navigate = vi.fn();

		const message = await sendToArchive({ token: "t", projectKey: "p", sessionId: "old", routeSessionId: "now", navigate });

		expect(message).toBeNull();
		expect(navigate).not.toHaveBeenCalled();
		expect(archiveSession).toHaveBeenCalledWith({ token: "t", projectKey: "p", sessionId: "old" });
	});

	it("goes Home with the token when the session the page names is archived", async () => {
		vi.mocked(archiveSession).mockResolvedValue({ ok: true, data: { archived: "now" } });
		const navigate = vi.fn();

		await sendToArchive({ token: "a b", projectKey: "p", sessionId: "now", routeSessionId: "now", navigate });

		expect(navigate).toHaveBeenCalledWith("/?token=a%20b");
	});

	it("answers the observer's message and stays when the archive is refused", async () => {
		vi.mocked(archiveSession).mockResolvedValue({ ok: false, status: 409, message: "That session is still live." });
		const navigate = vi.fn();

		const message = await sendToArchive({ token: "t", projectKey: "p", sessionId: "now", routeSessionId: "now", navigate });

		expect(message).toBe("That session is still live.");
		expect(navigate).not.toHaveBeenCalled();
	});

	it("stays put after an archive when the caller names no route session (Home)", async () => {
		vi.mocked(archiveSession).mockResolvedValue({ ok: true, data: { archived: "old" } });
		const navigate = vi.fn();

		expect(await sendToArchive({ token: "t", projectKey: "p", sessionId: "old", navigate })).toBeNull();
		expect(navigate).not.toHaveBeenCalled();
	});
});
