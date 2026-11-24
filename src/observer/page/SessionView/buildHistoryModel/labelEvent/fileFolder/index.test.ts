import { describe, expect, it } from "vitest";
import fileFolder from "./index.js";

describe("fileFolder", () => {
	it.each([
		["src/tools/score/plan.aide", "src/tools/score"],
		["plan.aide", "."],
		[".aide/plan.aide", "."],
		[".aide/docs/index.md", ".aide/docs"],
	])("puts %s in %s", (path, folder) => {
		expect(fileFolder(path)).toBe(folder);
	});
});
