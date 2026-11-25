import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import resolveArchivedLog from "./index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

const ID = "20261122T090000000Z-aaaaaa";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveArchivedLog", () => {
	it("returns <root>/<projectKey>/archive/<id>.jsonl on linux", () => {
		mockPlatform.mockReturnValue("linux");
		mockHomedir.mockReturnValue("/home/me");
		vi.stubEnv("XDG_STATE_HOME", "");
		expect(resolveArchivedLog({ projectKey: "app-3f9a2c", sessionId: ID })).toBe(
			`/home/me/.local/state/aidemd/app-3f9a2c/archive/${ID}.jsonl`,
		);
	});

	it("throws on an unsafe project key", () => {
		expect(() => resolveArchivedLog({ projectKey: "../x", sessionId: ID })).toThrow(/Invalid project key/);
	});

	it.each([[""], ["../x"], ["a/b"], [".hidden"]])("throws on session id %j", (sessionId) => {
		expect(() => resolveArchivedLog({ projectKey: "app-3f9a2c", sessionId })).toThrow(/Invalid session id/);
	});
});
