import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fetchPublishedVersions from "./index.js";

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

const VALID_BODY = {
	"dist-tags": { latest: "0.13.1" },
	versions: { "0.12.0": {}, "0.13.0": {}, "0.13.1": {} },
};

describe("fetchPublishedVersions", () => {
	it("returns latest and every version on an ok response, requesting the unencoded scoped URL with the abbreviated Accept header and a timeout signal", async () => {
		mockFetch.mockResolvedValue(respond(true, VALID_BODY));
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toEqual({
			latest: "0.13.1",
			versions: ["0.12.0", "0.13.0", "0.13.1"],
		});
		expect(mockFetch).toHaveBeenCalledWith(
			"https://registry.npmjs.org/@aidemd-mcp/server",
			expect.objectContaining({
				headers: expect.objectContaining({ Accept: "application/vnd.npm.install-v1+json" }),
				signal: expect.any(AbortSignal),
			}),
		);
	});

	it("returns null on a non-2xx response", async () => {
		mockFetch.mockResolvedValue(respond(false, VALID_BODY));
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when fetch rejects (offline)", async () => {
		mockFetch.mockRejectedValue(new Error("offline"));
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when the request times out", async () => {
		mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toBeNull();
	});

	it("returns null when json() rejects", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => {
				throw new SyntaxError("bad json");
			},
		} as unknown as Response);
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toBeNull();
	});

	it.each([
		["no dist-tags", { versions: { "0.13.1": {} } }],
		["an empty latest", { "dist-tags": { latest: "" }, versions: { "0.13.1": {} } }],
		["a non-string latest", { "dist-tags": { latest: 13 }, versions: { "0.13.1": {} } }],
		["missing versions", { "dist-tags": { latest: "0.13.1" } }],
		["null versions", { "dist-tags": { latest: "0.13.1" }, versions: null }],
		["a latest not among the version keys", { "dist-tags": { latest: "0.14.0" }, versions: { "0.13.1": {} } }],
	])("returns null for a malformed document: %s", async (_label, body) => {
		mockFetch.mockResolvedValue(respond(true, body));
		expect(await fetchPublishedVersions("@aidemd-mcp/server")).toBeNull();
	});
});
