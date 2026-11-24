import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolve from "./index.js";
import nameProjectFolder from "./nameProjectFolder/index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolve", () => {
	it("resolves win32 paths", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
		const projectRoot = "D:\\Code\\app";
		const folder = `C:\\Users\\me\\AppData\\Local\\aidemd\\${nameProjectFolder({ projectRoot })}`;
		expect(resolve({ projectRoot })).toEqual({
			projectKey: nameProjectFolder({ projectRoot }),
			folder,
			eventsFolder: `${folder}\\events`,
		});
	});

	it("resolves macOS paths", () => {
		mockPlatform.mockReturnValue("darwin");
		mockHomedir.mockReturnValue("/Users/me");
		const projectRoot = "/Users/me/code/app";
		const folder = `/Users/me/Library/Application Support/aidemd/${nameProjectFolder({ projectRoot })}`;
		expect(resolve({ projectRoot })).toEqual({
			projectKey: nameProjectFolder({ projectRoot }),
			folder,
			eventsFolder: `${folder}/events`,
		});
	});

	it("resolves linux paths", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		const projectRoot = "/home/me/code/app";
		const folder = `/home/me/.local/state/aidemd/${nameProjectFolder({ projectRoot })}`;
		expect(resolve({ projectRoot })).toEqual({
			projectKey: nameProjectFolder({ projectRoot }),
			folder,
			eventsFolder: `${folder}/events`,
		});
	});

	it("returns the folder name as projectKey, equal to nameProjectFolder for the same root", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		const projectRoot = "/home/me/code/app";
		const paths = resolve({ projectRoot });
		expect(paths.projectKey).toBe(nameProjectFolder({ projectRoot }));
		expect(paths.folder.endsWith(`/${paths.projectKey}`)).toBe(true);
	});

	it("never creates anything on disk", () => {
		const home = path.join(tmpdir(), `aide-resolve-missing-${process.pid}-${Date.now()}`);
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue(home);
		vi.stubEnv("XDG_STATE_HOME", "");
		const result = resolve({ projectRoot: "/somewhere/else/app" });
		expect(existsSync(home)).toBe(false);
		expect(existsSync(result.folder)).toBe(false);
	});

	it("throws when the project root is the home directory on linux", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		expect(() => resolve({ projectRoot: "/home/me" })).toThrow("/home/me");
	});

	it("throws when XDG_STATE_HOME points inside the project root", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "/home/me/app/state");
		expect(() => resolve({ projectRoot: "/home/me/app" })).toThrow("/home/me/app");
	});
});
