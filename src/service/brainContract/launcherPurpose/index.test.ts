import { describe, it, expect } from "vitest";
import brainContract from "../index.js";
import launcherPurpose from "./index.js";

describe("launcherPurpose", () => {
	it("is non-empty after trimming", () => {
		expect(launcherPurpose.trim().length).toBeGreaterThan(0);
	});

	it("is a single line", () => {
		expect(launcherPurpose).not.toMatch(/[\r\n]/);
	});

	it("stays backend-neutral", () => {
		expect(launcherPurpose).not.toMatch(/\bobsidian\b|vault|wikilink|\[\[|mcp__|kanban-plugin/i);
	});

	it("differs from every section purpose", () => {
		for (const entry of brainContract) expect(launcherPurpose).not.toBe(entry.purpose);
	});
});
