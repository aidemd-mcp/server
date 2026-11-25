import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveEndedMark from "./index.js";
import resolve from "../resolve/index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

const CLAUDE_ID = "3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b";
const OBSERVER_ID = "20261125T101500123Z-3f9a2c";

function useLinux(): void {
	mockPlatform.mockReturnValue("linux");
	mockHomedir.mockReturnValue("/home/me");
	vi.stubEnv("XDG_STATE_HOME", "");
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveEndedMark", () => {
	it("returns <root>/<projectKey>/ended/<id>.json for an observer session id", () => {
		useLinux();
		expect(resolveEndedMark({ projectKey: "app-3f9a2c", id: OBSERVER_ID })).toBe(
			`/home/me/.local/state/aidemd/app-3f9a2c/ended/${OBSERVER_ID}.json`,
		);
	});

	it("accepts a UUID-shaped Claude id", () => {
		useLinux();
		expect(resolveEndedMark({ projectKey: "app-3f9a2c", id: CLAUDE_ID })).toBe(
			`/home/me/.local/state/aidemd/app-3f9a2c/ended/${CLAUDE_ID}.json`,
		);
	});

	it("returns a backslash path on win32", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		vi.stubEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
		expect(resolveEndedMark({ projectKey: "app-3f9a2c", id: OBSERVER_ID })).toBe(
			`C:\\Users\\me\\AppData\\Local\\aidemd\\app-3f9a2c\\ended\\${OBSERVER_ID}.json`,
		);
	});

	it("lands inside the ended folder resolve names for the same project", () => {
		useLinux();
		const { projectKey, endedFolder } = resolve({ projectRoot: "/home/me/code/app" });
		expect(resolveEndedMark({ projectKey, id: OBSERVER_ID })).toBe(`${endedFolder}/${OBSERVER_ID}.json`);
	});

	it.each([
		["dot-dot", ".."],
		["a forward slash", "a/b-3f9a2c"],
		["uppercase hex", "x-3F9A2C"],
		["a short hash", "x-3f9a2"],
		["a leading dot", ".hidden-3f9a2c"],
		["a NUL", "x\0y-3f9a2c"],
	])("throws on a project key with %s", (_label, projectKey) => {
		useLinux();
		expect(() => resolveEndedMark({ projectKey, id: OBSERVER_ID })).toThrow(/Invalid project key/);
	});

	it.each([[""], ["../x"], ["a/b"], ["a\\b"], [".."], [".hidden"]])("throws on id %j", (id) => {
		useLinux();
		expect(() => resolveEndedMark({ projectKey: "app-3f9a2c", id })).toThrow(/Invalid session id/);
	});
});
