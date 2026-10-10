import { describe, it, expect } from "vitest";
import isOlderVersion from "./index.js";

describe("isOlderVersion", () => {
	it("is true for an older patch", () => {
		expect(isOlderVersion("0.16.0", "0.16.1")).toBe(true);
	});

	it("is true for an older minor even with a higher patch", () => {
		expect(isOlderVersion("0.15.9", "0.16.0")).toBe(true);
	});

	it("is true for an older major", () => {
		expect(isOlderVersion("0.99.99", "1.0.0")).toBe(true);
	});

	it("is false for an equal version", () => {
		expect(isOlderVersion("0.16.0", "0.16.0")).toBe(false);
	});

	it("is false for a newer version", () => {
		expect(isOlderVersion("0.17.0", "0.16.0")).toBe(false);
		expect(isOlderVersion("1.0.0", "0.16.0")).toBe(false);
	});

	it("compares numerically, not lexically", () => {
		expect(isOlderVersion("0.9.0", "0.16.0")).toBe(true);
		expect(isOlderVersion("0.16.0", "0.9.0")).toBe(false);
	});

	it.each(["latest", "^0.15.0", "0.15", "0.15.0-beta.1", ""])("is false for the non-exact version %j", (version) => {
		expect(isOlderVersion(version, "0.16.0")).toBe(false);
	});

	it("is false when the pin is not exact", () => {
		expect(isOlderVersion("0.15.0", "latest")).toBe(false);
	});
});
