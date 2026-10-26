import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./fetchChangelog/index.js", () => ({ default: vi.fn() }));
vi.mock("./pickHighlights/index.js", () => ({ default: vi.fn() }));

import fetchChangelog from "./fetchChangelog/index.js";
import pickHighlights from "./pickHighlights/index.js";
import resolveHighlights from "./index.js";

const mockFetchChangelog = fetchChangelog as ReturnType<typeof vi.fn>;
const mockPickHighlights = pickHighlights as ReturnType<typeof vi.fn>;

const SKIPPED = ["0.13.1", "0.13.0"];

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resolveHighlights", () => {
	it("fetches the latest changelog and returns what pickHighlights picks from it", async () => {
		mockFetchChangelog.mockResolvedValue("# Changelog text");
		mockPickHighlights.mockReturnValue(["a new board review"]);

		const result = await resolveHighlights("@aidemd-mcp/server", "0.13.1", SKIPPED);

		expect(mockFetchChangelog).toHaveBeenCalledWith("@aidemd-mcp/server", "0.13.1");
		expect(mockPickHighlights).toHaveBeenCalledWith("# Changelog text", SKIPPED);
		expect(result).toEqual(["a new board review"]);
	});

	it("returns [] without picking when the changelog cannot be fetched", async () => {
		mockFetchChangelog.mockResolvedValue(null);

		const result = await resolveHighlights("@aidemd-mcp/server", "0.13.1", SKIPPED);

		expect(result).toEqual([]);
		expect(mockPickHighlights).not.toHaveBeenCalled();
	});
});
