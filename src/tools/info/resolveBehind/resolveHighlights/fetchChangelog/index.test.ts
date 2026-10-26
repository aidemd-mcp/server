import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fetchChangelog from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
	mockFetch.mockReset();
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function respond(ok: boolean, text: string): Response {
	return { ok, text: async () => text } as unknown as Response;
}

describe("fetchChangelog", () => {
	it("returns the changelog text, requesting the version-pinned CDN URL with a timeout signal", async () => {
		mockFetch.mockResolvedValue(respond(true, "# Changelog\n"));
		expect(await fetchChangelog("@aidemd-mcp/server", "0.13.1")).toBe("# Changelog\n");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://cdn.jsdelivr.net/npm/@aidemd-mcp/server@0.13.1/CHANGELOG.md",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("returns null on a non-2xx response (404)", async () => {
		mockFetch.mockResolvedValue(respond(false, "Not found"));
		expect(await fetchChangelog("@aidemd-mcp/server", "0.13.1")).toBeNull();
	});

	it("returns null when fetch rejects", async () => {
		mockFetch.mockRejectedValue(new Error("offline"));
		expect(await fetchChangelog("@aidemd-mcp/server", "0.13.1")).toBeNull();
	});

	it("returns null when the request times out", async () => {
		mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));
		expect(await fetchChangelog("@aidemd-mcp/server", "0.13.1")).toBeNull();
	});

	it("returns null when text() rejects", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			text: async () => {
				throw new Error("body stream failed");
			},
		} as unknown as Response);
		expect(await fetchChangelog("@aidemd-mcp/server", "0.13.1")).toBeNull();
	});
});
