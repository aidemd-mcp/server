import { describe, it, expect, vi } from "vitest";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()) };
});

import { platform } from "node:os";
import pickPathModule from "./index.js";

const mockPlatform = vi.mocked(platform);

describe("pickPathModule", () => {
	it("returns path.win32 on win32", () => {
		mockPlatform.mockReturnValue("win32");
		expect(pickPathModule()).toBe(path.win32);
	});

	it.each(["darwin", "linux"] as const)("returns path.posix on %s", (name) => {
		mockPlatform.mockReturnValue(name);
		expect(pickPathModule()).toBe(path.posix);
	});
});
