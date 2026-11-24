import { describe, expect, it } from "vitest";
import projectPath from "./index.js";

describe("projectPath", () => {
	it("joins the encoded project key and the rest under /api/projects", () => {
		expect(projectPath({ projectKey: "my app-1a2b3c", rest: "status" })).toBe("/api/projects/my%20app-1a2b3c/status");
	});

	it("leaves the rest exactly as given, so its own encoding survives", () => {
		expect(projectPath({ projectKey: "k", rest: "file?path=src%2Fa.ts" })).toBe("/api/projects/k/file?path=src%2Fa.ts");
	});
});
