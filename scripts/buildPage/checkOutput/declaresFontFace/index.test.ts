import { describe, expect, it } from "vitest";
import declaresFontFace from "./index.js";

describe("declaresFontFace", () => {
	it.each([
		["a quoted family", `@font-face{font-family:"JetBrains Mono";src:url(data:x)}`],
		["an unquoted family", `@font-face { font-family: Inter; src: url(data:x); }`],
		["a single-quoted family", `@font-face{font-family:'Inter'}`],
	])("finds %s", (_label, css) => {
		const family = css.includes("JetBrains") ? "JetBrains Mono" : "Inter";
		expect(declaresFontFace({ css, family })).toBe(true);
	});

	it("rejects a family that no @font-face rule declares", () => {
		expect(declaresFontFace({ css: `@font-face{font-family:Inter}`, family: "JetBrains Mono" })).toBe(false);
	});

	it("ignores a font-family declaration outside an @font-face rule", () => {
		expect(declaresFontFace({ css: `body{font-family:Inter}`, family: "Inter" })).toBe(false);
	});
});
