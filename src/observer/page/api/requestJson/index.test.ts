import { afterEach, describe, expect, it, vi } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import requestJson from "./index.js";

function stubFetch(response: Response | Error): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("requestJson", () => {
	it("sends the token in the protocol's header", async () => {
		const fetchMock = stubFetch(jsonResponse({ data: { ok: 1 } }, 200));
		await requestJson({ path: "/api/projects", token: "tok" });
		expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
			method: "GET",
			headers: { [protocol.tokenHeader]: "tok" },
		});
	});

	it("returns the data on 200", async () => {
		stubFetch(jsonResponse({ data: { projects: [] } }, 200));
		expect(await requestJson({ path: "/api/projects", token: "tok" })).toEqual({ ok: true, data: { projects: [] } });
	});

	it("returns the observer's message and details on 404", async () => {
		stubFetch(jsonResponse({ error: { message: "No such project.", details: "gone" } }, 404));
		expect(await requestJson({ path: "/x", token: "tok" })).toEqual({
			ok: false,
			status: 404,
			message: "No such project.",
			details: "gone",
		});
	});

	it("returns the observer's message on 409 without inventing details", async () => {
		stubFetch(jsonResponse({ error: { message: "Session is live." } }, 409));
		expect(await requestJson({ path: "/x", token: "tok", method: "DELETE" })).toEqual({
			ok: false,
			status: 409,
			message: "Session is live.",
		});
	});

	it("reports status 0 and the unreachable message when fetch rejects", async () => {
		stubFetch(new TypeError("Failed to fetch"));
		expect(await requestJson({ path: "/x", token: "tok" })).toEqual({
			ok: false,
			status: 0,
			message: "The observer could not be reached.",
		});
	});

	it("keeps the HTTP status when the body is not JSON", async () => {
		stubFetch(new Response("Service Unavailable", { status: 503 }));
		const result = await requestJson({ path: "/x", token: "tok" });
		expect(result).toMatchObject({ ok: false, status: 503 });
	});
});
