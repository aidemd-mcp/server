import { describe, expect, it } from "vitest";
import moduleLabel from "./index.js";

describe("moduleLabel", () => {
	it("names the root module after the project", () => {
		expect(moduleLabel({ folder: ".", projectName: "aidemd-mcp" })).toBe("aidemd-mcp");
	});

	it("leaves any other folder as reported", () => {
		expect(moduleLabel({ folder: "src/tools/score", projectName: "aidemd-mcp" })).toBe("src/tools/score");
	});
});
