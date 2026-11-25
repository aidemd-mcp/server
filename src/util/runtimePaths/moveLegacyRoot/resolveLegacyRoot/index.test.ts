import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => "win32"), homedir: vi.fn(() => "C:\\Users\\me") };
});

import { platform } from "node:os";
import resolveLegacyRoot from "./index.js";

const mockPlatform = vi.mocked(platform);

beforeEach(() => {
	mockPlatform.mockReturnValue("win32");
	vi.stubEnv("AIDEMD_HOME", "");
	vi.stubEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveLegacyRoot", () => {
	it.each(["darwin", "linux"] as const)("is null on %s", (os) => {
		mockPlatform.mockReturnValue(os);
		expect(resolveLegacyRoot()).toBeNull();
	});

	it("is null when AIDEMD_HOME is an absolute path", () => {
		vi.stubEnv("AIDEMD_HOME", "D:\\isolated\\aidemd");
		expect(resolveLegacyRoot()).toBeNull();
	});

	it.each(["", "relative\\home"])("ignores AIDEMD_HOME %j", (value) => {
		vi.stubEnv("AIDEMD_HOME", value);
		expect(resolveLegacyRoot()).toBe("C:\\Users\\me\\AppData\\Local\\aidemd");
	});

	it("joins aidemd onto an absolute LOCALAPPDATA", () => {
		vi.stubEnv("LOCALAPPDATA", "E:\\Data\\Local");
		expect(resolveLegacyRoot()).toBe("E:\\Data\\Local\\aidemd");
	});

	it.each(["", "relative\\local"])("falls back to <home>\\AppData\\Local for LOCALAPPDATA %j", (value) => {
		vi.stubEnv("LOCALAPPDATA", value);
		expect(resolveLegacyRoot()).toBe("C:\\Users\\me\\AppData\\Local\\aidemd");
	});
});
