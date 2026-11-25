import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveAppDataRoot from "./index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

beforeEach(() => {
	// The test setup points AIDEMD_HOME at a temp folder; "" reads as unset.
	vi.stubEnv("AIDEMD_HOME", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveAppDataRoot", () => {
	it("uses <home>\\.aidemd on Windows and ignores LOCALAPPDATA", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "D:\\Elsewhere\\Local");
		expect(resolveAppDataRoot()).toBe("C:\\Users\\me\\.aidemd");
	});

	it("uses <home>\\.aidemd on Windows without LOCALAPPDATA", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "");
		expect(resolveAppDataRoot()).toBe("C:\\Users\\me\\.aidemd");
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

	it.each([
		["win32", "C:\\Users\\me", "D:\\data\\aide"],
		["darwin", "/Users/me", "/data/aide"],
		["linux", "/home/me", "/data/aide"],
	] as const)("AIDEMD_HOME absolute is the root itself on %s", (os, home, override) => {
		mockPlatform.mockReturnValue(os);
		mockHomedir.mockReturnValue(home);
		vi.stubEnv("AIDEMD_HOME", override);
		vi.stubEnv("XDG_STATE_HOME", "/var/state");
		expect(resolveAppDataRoot()).toBe(override);
	});

	it.each([
		["empty", ""],
		["relative", "aide/home"],
	])("ignores an AIDEMD_HOME that is %s and uses the per-OS default", (_label, value) => {
		vi.stubEnv("AIDEMD_HOME", value);
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		expect(resolveAppDataRoot()).toBe("C:\\Users\\me\\.aidemd");

		mockPlatform.mockReturnValue("darwin");
		mockHomedir.mockReturnValue("/Users/me");
		expect(resolveAppDataRoot()).toBe("/Users/me/Library/Application Support/aidemd");

		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		expect(resolveAppDataRoot()).toBe("/home/me/.local/state/aidemd");
	});
});
