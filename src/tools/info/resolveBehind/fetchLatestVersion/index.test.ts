import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fetchLatestVersion from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
	mockFetch.mockReset();
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function respond(ok: boolean, body: unknown): Response {
	return { ok, json: async () => body } as unknown as Response;
}

describe("fetchLatestVersion", () => {
	it("returns the version on an ok response and requests the unencoded scoped URL with a timeout signal", async () => {
		mockFetch.mockResolvedValue(respond(true, { version: "1.2.3" }));
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBe("1.2.3");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://registry.npmjs.org/@aidemd-mcp/server/latest",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("returns null on a non-2xx response", async () => {
		mockFetch.mockResolvedValue(respond(false, { version: "1.2.3" }));
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when fetch throws", async () => {
		mockFetch.mockRejectedValue(new Error("offline"));
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when the request aborts", async () => {
		mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when the body has no version", async () => {
		mockFetch.mockResolvedValue(respond(true, {}));
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when the body is not valid JSON", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => {
				throw new SyntaxError("bad json");
			},
		} as unknown as Response);
		expect(await fetchLatestVersion("@aidemd-mcp/server")).toBeNull();
	});
});
