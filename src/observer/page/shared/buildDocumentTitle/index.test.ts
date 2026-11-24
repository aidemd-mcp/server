import { describe, expect, it } from "vitest";
import pageTitle from "@/observer/shared/pageTitle/index.js";
import buildDocumentTitle from "./index.js";

describe("buildDocumentTitle", () => {
	it("is the shared base copy on Home", () => {
		expect(buildDocumentTitle({ waiting: false })).toBe(pageTitle);
		expect(pageTitle).toBe("AIDE Pipeline Viewer");
	});

	it("puts the project first on a session view", () => {
		expect(buildDocumentTitle({ project: "aidemd-mcp", waiting: false })).toBe("aidemd-mcp — AIDE Pipeline Viewer");
	});

	it("starts with Waiting on you while a gate is open, on both screens", () => {
		expect(buildDocumentTitle({ waiting: true })).toBe("Waiting on you — AIDE Pipeline Viewer");
		expect(buildDocumentTitle({ project: "aidemd-mcp", waiting: true })).toBe(
			"Waiting on you — aidemd-mcp — AIDE Pipeline Viewer",
		);
	});
});
