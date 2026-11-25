import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveEventLog from "./index.js";
import resolve from "../resolve/index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

const UUID = "3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b";

beforeEach(() => {
	vi.stubEnv("AIDEMD_HOME", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveEventLog", () => {
	it("returns <eventsFolder>/<uuid>.jsonl on linux", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		const projectRoot = "/home/me/code/app";
		const { eventsFolder } = resolve({ projectRoot });
		expect(resolveEventLog({ projectRoot, sessionId: UUID })).toBe(`${eventsFolder}/${UUID}.jsonl`);
	});

	it("returns <eventsFolder>\\<uuid>.jsonl on win32", () => {
		mockPlatform.mockReturnValue("win32");
		mockHomedir.mockReturnValue("C:\\Users\\me");
		const projectRoot = "D:\\Code\\app";
		const { eventsFolder } = resolve({ projectRoot });
		const result = resolveEventLog({ projectRoot, sessionId: UUID });
		expect(result).toBe(`${eventsFolder}\\${UUID}.jsonl`);
		expect(result).toContain("\\");
	});

	it.each([
		["empty", ""],
		["dot", "."],
		["dot-dot", ".."],
		["parent traversal", "../x"],
		["forward slash", "a/b"],
		["backslash", "a\\b"],
		["leading dot", ".hidden"],
		["129 characters", "a".repeat(129)],
	])("rejects a session id that is %s", (_label, sessionId) => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		expect(() => resolveEventLog({ projectRoot: "/home/me/code/app", sessionId })).toThrow(
			/Invalid session id/,
		);
	});
});
