import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveRoot from "./index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveRoot", () => {
	it("resolves the win32 root and record", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
		expect(resolveRoot()).toEqual({
			root: "C:\\Users\\me\\AppData\\Local\\aidemd",
			observerFile: "C:\\Users\\me\\AppData\\Local\\aidemd\\observer.json",
		});
	});

	it("resolves the macOS root and record", () => {
		mockPlatform.mockReturnValue("darwin");
		mockHomedir.mockReturnValue("/Users/me");
		expect(resolveRoot()).toEqual({
			root: "/Users/me/Library/Application Support/aidemd",
			observerFile: "/Users/me/Library/Application Support/aidemd/observer.json",
		});
	});

	it("resolves the linux root and record", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		expect(resolveRoot()).toEqual({
			root: "/home/me/.local/state/aidemd",
			observerFile: "/home/me/.local/state/aidemd/observer.json",
		});
	});

	it("answers the same for every call, with no project segment", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "/var/state");
		const first = resolveRoot();
		expect(resolveRoot()).toEqual(first);
		expect(first.observerFile).toBe("/var/state/aidemd/observer.json");
	});
});
