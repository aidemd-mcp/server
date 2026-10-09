import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./readAideLaunchMode/index.js", () => ({ default: vi.fn() }));
vi.mock("./fetchLatestVersion/index.js", () => ({ default: vi.fn() }));
vi.mock("./isVersionBehind/index.js", () => ({ default: vi.fn() }));

import readAideLaunchMode from "./readAideLaunchMode/index.js";
import fetchLatestVersion from "./fetchLatestVersion/index.js";
import isVersionBehind from "./isVersionBehind/index.js";
import resolveBehind from "./index.js";

const mockMode = readAideLaunchMode as ReturnType<typeof vi.fn>;
const mockFetch = fetchLatestVersion as ReturnType<typeof vi.fn>;
const mockBehind = isVersionBehind as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.resetAllMocks();
	mockMode.mockResolvedValue("global");
	mockFetch.mockResolvedValue("0.10.0");
	mockBehind.mockReturnValue(true);
});

describe("resolveBehind", () => {
	it("returns null for a local launch without hitting the network", async () => {
		mockMode.mockResolvedValue("local");
		expect(await resolveBehind("/root", "0.9.0")).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns null when no aide entry is found", async () => {
		mockMode.mockResolvedValue(null);
		expect(await resolveBehind("/root", "0.9.0")).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns null for an unknown server version without hitting the network", async () => {
		expect(await resolveBehind("/root", "unknown")).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns null when the latest version cannot be fetched", async () => {
		mockFetch.mockResolvedValue(null);
		expect(await resolveBehind("/root", "0.9.0")).toBeNull();
	});

	it("returns a notice when behind", async () => {
		expect(await resolveBehind("/root", "0.9.0")).toEqual({ installed: "0.9.0", latest: "0.10.0" });
		expect(mockFetch).toHaveBeenCalledWith("@aidemd-mcp/server");
		expect(mockBehind).toHaveBeenCalledWith("0.9.0", "0.10.0");
	});

	it("returns null when up to date", async () => {
		mockBehind.mockReturnValue(false);
		expect(await resolveBehind("/root", "0.10.0")).toBeNull();
	});
});
