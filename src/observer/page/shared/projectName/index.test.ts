import { describe, expect, it } from "vitest";
import projectName from "./index.js";

describe("projectName", () => {
	it("uses the last segment of the reported root", () => {
		expect(projectName({ projectRoot: "D:\\Code\\Me\\aidemd-mcp", projectKey: "aidemd-mcp-1a2b3c" })).toBe("aidemd-mcp");
	});

	it("falls back to the key without its six-hex suffix", () => {
		expect(projectName({ projectRoot: null, projectKey: "aidemd-mcp-1a2b3c" })).toBe("aidemd-mcp");
	});

	it("keeps a key that has no hex suffix", () => {
		expect(projectName({ projectRoot: null, projectKey: "scratch" })).toBe("scratch");
	});
});
