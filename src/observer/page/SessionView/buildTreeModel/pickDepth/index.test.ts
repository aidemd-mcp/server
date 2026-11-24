import { describe, expect, it } from "vitest";
import pickDepth from "./index.js";

describe("pickDepth", () => {
	it.each([
		[".", 0],
		["src", 1],
		["src/tools", 2],
		["src/tools/score", 3],
		["src/tools/score/deep", 4],
		["src/tools/score/deep/deeper", 4],
	])("%s is depth %i", (folder, depth) => {
		expect(pickDepth({ folder })).toBe(depth);
	});
});
