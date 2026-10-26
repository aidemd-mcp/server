import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./readAideLaunchMode/index.js", () => ({ default: vi.fn() }));
vi.mock("./fetchPublishedVersions/index.js", () => ({ default: vi.fn() }));
vi.mock("./shared/isVersionBehind/index.js", () => ({ default: vi.fn() }));
vi.mock("./listSkippedVersions/index.js", () => ({ default: vi.fn() }));
vi.mock("./resolveHighlights/index.js", () => ({ default: vi.fn() }));

import readAideLaunchMode from "./readAideLaunchMode/index.js";
import fetchPublishedVersions from "./fetchPublishedVersions/index.js";
import isVersionBehind from "./shared/isVersionBehind/index.js";
import listSkippedVersions from "./listSkippedVersions/index.js";
import resolveHighlights from "./resolveHighlights/index.js";
import resolveBehind from "./index.js";

const mockLaunch = readAideLaunchMode as ReturnType<typeof vi.fn>;
const mockPublished = fetchPublishedVersions as ReturnType<typeof vi.fn>;
const mockBehind = isVersionBehind as ReturnType<typeof vi.fn>;
const mockSkipped = listSkippedVersions as ReturnType<typeof vi.fn>;
const mockHighlights = resolveHighlights as ReturnType<typeof vi.fn>;

const VERSIONS = ["0.12.0", "0.13.0", "0.13.1"];
const HIGHLIGHTS = ["a new board review", "a fixed brain-config skip"];

beforeEach(() => {
	vi.resetAllMocks();
	mockLaunch.mockResolvedValue("global");
	mockPublished.mockResolvedValue({ latest: "0.13.1", versions: VERSIONS });
	mockBehind.mockReturnValue(true);
	mockSkipped.mockReturnValue(["0.13.1", "0.13.0"]);
	mockHighlights.mockResolvedValue(HIGHLIGHTS);
});

describe("resolveBehind", () => {
	it("returns the full notice for a global launch that is behind", async () => {
		expect(await resolveBehind("/root", "0.12.0")).toEqual({
			installed: "0.12.0",
			latest: "0.13.1",
			launch: "global",
			versionsBehind: 2,
			highlights: HIGHLIGHTS,
		});
		expect(mockPublished).toHaveBeenCalledWith("@aidemd-mcp/server");
		expect(mockBehind).toHaveBeenCalledWith("0.12.0", "0.13.1");
		expect(mockSkipped).toHaveBeenCalledWith("0.12.0", "0.13.1", VERSIONS);
		expect(mockHighlights).toHaveBeenCalledWith("@aidemd-mcp/server", "0.13.1", [
			"0.13.1",
			"0.13.0",
		]);
	});

	it("judges a local (npx) launch on the running version", async () => {
		mockLaunch.mockResolvedValue("local");
		expect(await resolveBehind("/root", "0.12.0")).toEqual({
			installed: "0.12.0",
			latest: "0.13.1",
			launch: "local",
			versionsBehind: 2,
			highlights: HIGHLIGHTS,
		});
	});

	it("still returns the notice when highlights are unavailable", async () => {
		mockHighlights.mockResolvedValue([]);
		expect(await resolveBehind("/root", "0.12.0")).toEqual({
			installed: "0.12.0",
			latest: "0.13.1",
			launch: "global",
			versionsBehind: 2,
			highlights: [],
		});
	});

	it("returns null when no aide entry is found, without hitting the network", async () => {
		mockLaunch.mockResolvedValue(null);
		expect(await resolveBehind("/root", "0.12.0")).toBeNull();
		expect(mockPublished).not.toHaveBeenCalled();
	});

	it.each(["global", "local"])(
		"returns null for an unknown server version on a %s launch without hitting the network",
		async (launch) => {
			mockLaunch.mockResolvedValue(launch);
			expect(await resolveBehind("/root", "unknown")).toBeNull();
			expect(mockPublished).not.toHaveBeenCalled();
		},
	);

	it("returns null when the published versions cannot be fetched", async () => {
		mockPublished.mockResolvedValue(null);
		expect(await resolveBehind("/root", "0.12.0")).toBeNull();
		expect(mockHighlights).not.toHaveBeenCalled();
	});

	it("returns null when up to date, without listing or fetching highlights", async () => {
		mockBehind.mockReturnValue(false);
		expect(await resolveBehind("/root", "0.13.1")).toBeNull();
		expect(mockSkipped).not.toHaveBeenCalled();
		expect(mockHighlights).not.toHaveBeenCalled();
	});
});
