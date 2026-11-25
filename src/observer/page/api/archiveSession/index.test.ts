import { afterEach, describe, expect, it, vi } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import archiveSession from "./index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("archiveSession", () => {
	it("sends POST to the encoded session's archive path with the token", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(new Response(JSON.stringify({ data: { archived: "s 1" } }), { status: 200 })),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await archiveSession({ token: "tok", projectKey: "my app-1a2b3c", sessionId: "s 1" });

		expect(fetchMock).toHaveBeenCalledWith("/api/projects/my%20app-1a2b3c/sessions/s%201/archive", {
			method: "POST",
			headers: { [protocol.tokenHeader]: "tok" },
		});
		expect(result).toEqual({ ok: true, data: { archived: "s 1" } });
	});
});
