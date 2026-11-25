import { afterEach, describe, expect, it, vi } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import restoreSession from "./index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("restoreSession", () => {
	it("sends POST to the encoded archived session's restore path with the token", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(new Response(JSON.stringify({ data: { restored: "s 1" } }), { status: 200 })),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await restoreSession({ token: "tok", projectKey: "my app-1a2b3c", sessionId: "s 1" });

		expect(fetchMock).toHaveBeenCalledWith("/api/projects/my%20app-1a2b3c/archive/s%201/restore", {
			method: "POST",
			headers: { [protocol.tokenHeader]: "tok" },
		});
		expect(result).toEqual({ ok: true, data: { restored: "s 1" } });
	});
});
