import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveSessionLog from "./index.js";
import resolveEventLog from "../resolveEventLog/index.js";
import resolve from "../resolve/index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

const UUID = "3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b";

function useLinux(): void {
	mockPlatform.mockReturnValue("linux");
	mockHomedir.mockReturnValue("/home/me");
	vi.stubEnv("XDG_STATE_HOME", "");
}

beforeEach(() => {
	vi.stubEnv("AIDEMD_HOME", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveSessionLog", () => {
	it("returns <root>/<projectKey>/events/<id>.jsonl on linux", () => {
		useLinux();
		expect(resolveSessionLog({ projectKey: "app-3f9a2c", sessionId: UUID })).toBe(
			`/home/me/.local/state/aidemd/app-3f9a2c/events/${UUID}.jsonl`,
		);
	});

	it("returns a backslash path on win32", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		expect(resolveSessionLog({ projectKey: "app-3f9a2c", sessionId: UUID })).toBe(
			`C:\\Users\\me\\.aidemd\\app-3f9a2c\\events\\${UUID}.jsonl`,
		);
	});

	it("matches resolveEventLog's path for the same project", () => {
		useLinux();
		const projectRoot = "/home/me/code/app";
		const { projectKey } = resolve({ projectRoot });
		expect(resolveSessionLog({ projectKey, sessionId: UUID })).toBe(
			resolveEventLog({ projectRoot, sessionId: UUID }),
		);
	});

	it.each([
		["dot-dot", ".."],
		["a forward slash", "a/b-3f9a2c"],
		["uppercase hex", "x-3F9A2C"],
		["a short hash", "x-3f9a2"],
		["a leading dot", ".hidden-3f9a2c"],
		["a NUL", "x\0y-3f9a2c"],
		["over 255 characters", `${"a".repeat(249)}-3f9a2c`],
	])("throws on a project key with %s", (_label, projectKey) => {
		useLinux();
		expect(() => resolveSessionLog({ projectKey, sessionId: UUID })).toThrow(/Invalid project key/);
	});

	it.each([[""], ["../x"], ["a/b"], [".hidden"]])("throws on session id %j", (sessionId) => {
		useLinux();
		expect(() => resolveSessionLog({ projectKey: "app-3f9a2c", sessionId })).toThrow(/Invalid session id/);
	});
});
