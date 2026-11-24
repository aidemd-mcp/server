import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveAppDataRoot from "./index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveAppDataRoot", () => {
	it("uses LOCALAPPDATA on Windows when set", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
		expect(resolveAppDataRoot()).toBe("C:\\Users\\me\\AppData\\Local\\aidemd");
	});

	it("falls back to <home>\\AppData\\Local on Windows without LOCALAPPDATA", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "");
		expect(resolveAppDataRoot()).toBe("C:\\Users\\me\\AppData\\Local\\aidemd");
	});

	it("uses Application Support on macOS", () => {
		mockPlatform.mockReturnValue("darwin");
		mockHomedir.mockReturnValue("/Users/me");
		expect(resolveAppDataRoot()).toBe("/Users/me/Library/Application Support/aidemd");
	});

	it("uses XDG_STATE_HOME on Linux when set and absolute", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "/var/state");
		expect(resolveAppDataRoot()).toBe("/var/state/aidemd");
	});

	it.each([
		["unset", ""],
		["empty", ""],
		["relative", "state/here"],
	])("falls back to ~/.local/state on Linux when XDG_STATE_HOME is %s", (label, value) => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		// An unset variable and an empty one both read as falsy; stub "" for the unset case.
		vi.stubEnv("XDG_STATE_HOME", label === "unset" ? "" : value);
		if (label === "unset") delete process.env.XDG_STATE_HOME;
		expect(resolveAppDataRoot()).toBe("/home/me/.local/state/aidemd");
	});
});
