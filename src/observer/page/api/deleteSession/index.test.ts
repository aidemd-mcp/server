import { afterEach, describe, expect, it, vi } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import deleteSession from "./index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("deleteSession", () => {
	it("sends DELETE to the encoded session path with the token", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(new Response(JSON.stringify({ data: { deleted: "s 1" } }), { status: 200 })),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await deleteSession({ token: "tok", projectKey: "my app-1a2b3c", sessionId: "s 1" });

		expect(fetchMock).toHaveBeenCalledWith("/api/projects/my%20app-1a2b3c/sessions/s%201", {
			method: "DELETE",
			headers: { [protocol.tokenHeader]: "tok" },
		});
		expect(result).toEqual({ ok: true, data: { deleted: "s 1" } });
	});
});
