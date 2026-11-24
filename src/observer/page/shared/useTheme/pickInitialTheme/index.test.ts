import { describe, expect, it } from "vitest";
import pickInitialTheme from "./index.js";

describe("pickInitialTheme", () => {
	it.each([
		["dark", true, "dark"],
		["light", false, "light"],
		["dark", false, "dark"],
		["light", true, "light"],
	] as const)("lets the stored %s win when light is preferred=%s", (stored, prefersLight, expected) => {
		expect(pickInitialTheme({ stored, prefersLight })).toBe(expected);
	});

	it.each([
		[true, "light"],
		[false, "dark"],
	] as const)("follows prefers-color-scheme (light=%s) when nothing is stored", (prefersLight, expected) => {
		expect(pickInitialTheme({ stored: null, prefersLight })).toBe(expected);
	});

	it("ignores a stored value that is neither theme", () => {
		expect(pickInitialTheme({ stored: "sepia", prefersLight: true })).toBe("light");
		expect(pickInitialTheme({ stored: "", prefersLight: false })).toBe("dark");
	});
});
