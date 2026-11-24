import { describe, it, expect, vi } from "vitest";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()) };
});

import { platform } from "node:os";
import nameProjectFolder from "./index.js";

const mockPlatform = vi.mocked(platform);

const hashOf = (name: string): string => name.slice(name.lastIndexOf("-") + 1);

describe("nameProjectFolder", () => {
	it("names a win32 root <folder>-<6 hex>", () => {
		mockPlatform.mockReturnValue("win32");
		expect(nameProjectFolder({ projectRoot: "D:\\Code\\Me\\aidemd-mcp" })).toMatch(/^aidemd-mcp-[0-9a-f]{6}$/);
	});

	it("names a linux root <folder>-<6 hex>", () => {
		mockPlatform.mockReturnValue("linux");
		expect(nameProjectFolder({ projectRoot: "/home/me/aidemd-mcp" })).toMatch(/^aidemd-mcp-[0-9a-f]{6}$/);
	});

	it("is stable for the same input", () => {
		mockPlatform.mockReturnValue("linux");
		const first = nameProjectFolder({ projectRoot: "/home/me/app" });
		expect(nameProjectFolder({ projectRoot: "/home/me/app" })).toBe(first);
	});

	it("keeps the prefix but changes the hash for the same name in different parents", () => {
		mockPlatform.mockReturnValue("linux");
		const a = nameProjectFolder({ projectRoot: "/home/a/app" });
		const b = nameProjectFolder({ projectRoot: "/home/b/app" });
		expect(a.startsWith("app-")).toBe(true);
		expect(b.startsWith("app-")).toBe(true);
		expect(a).not.toBe(b);
	});

	it("ignores a trailing separator and .. segments", () => {
		mockPlatform.mockReturnValue("linux");
		const clean = nameProjectFolder({ projectRoot: "/home/me/app" });
		expect(nameProjectFolder({ projectRoot: "/home/me/app/" })).toBe(clean);
		expect(nameProjectFolder({ projectRoot: "/home/me/x/../app" })).toBe(clean);
	});

	it("treats win32 paths as case-insensitive", () => {
		mockPlatform.mockReturnValue("win32");
		expect(hashOf(nameProjectFolder({ projectRoot: "D:\\Code\\X" })))
			.toBe(hashOf(nameProjectFolder({ projectRoot: "d:\\code\\x" })));
	});

	it("treats linux paths as case-sensitive", () => {
		mockPlatform.mockReturnValue("linux");
		expect(hashOf(nameProjectFolder({ projectRoot: "/a/X" })))
			.not.toBe(hashOf(nameProjectFolder({ projectRoot: "/a/x" })));
	});

	it("names a filesystem root project-<hash>", () => {
		mockPlatform.mockReturnValue("linux");
		expect(nameProjectFolder({ projectRoot: "/" })).toMatch(/^project-[0-9a-f]{6}$/);
	});

	it("throws on a relative path", () => {
		mockPlatform.mockReturnValue("linux");
		expect(() => nameProjectFolder({ projectRoot: "relative/dir" })).toThrow("relative/dir");
	});
});
