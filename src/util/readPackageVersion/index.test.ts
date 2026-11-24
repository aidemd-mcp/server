import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

import { readFileSync } from "node:fs";
import readPackageVersion from "./index.js";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const actualReadFileSync = (await vi.importActual<typeof import("node:fs")>("node:fs")).readFileSync;

describe("readPackageVersion", () => {
	beforeEach(() => {
		mockReadFileSync.mockReset();
		mockReadFileSync.mockImplementation(actualReadFileSync);
	});

	it("returns the repo's package.json version when run from source", () => {
		const pkg = JSON.parse(actualReadFileSync("package.json", "utf-8")) as { version: string };
		expect(readPackageVersion()).toBe(pkg.version);
	});

	it("returns unknown when the read fails", () => {
		mockReadFileSync.mockImplementation(() => {
			throw new Error("ENOENT");
		});
		expect(readPackageVersion()).toBe("unknown");
	});

	it("returns unknown when package.json has no version", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify({ name: "x" }));
		expect(readPackageVersion()).toBe("unknown");
	});

	it("returns unknown when package.json is not valid JSON", () => {
		mockReadFileSync.mockReturnValue("{ not json");
		expect(readPackageVersion()).toBe("unknown");
	});
});
