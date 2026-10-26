import { describe, it, expect } from "vitest";
import isCodeFile from "./index.js";

describe("isCodeFile", () => {
	it.each([
		".aide",
		"intent.aide",
		"plan.aide",
		"brief.aide",
		"todo.aide",
		"research.aide",
		"session.aide",
		"README.md",
		"NOTES.MD",
		"guide.markdown",
		".DS_Store",
		".gitkeep",
		".gitignore",
		".eslintrc",
		".env",
	])("rejects %s", (name) => {
		expect(isCodeFile(name)).toBe(false);
	});

	it.each([
		"index.ts",
		"index.js",
		"run.py",
		"main.go",
		"lib.rs",
		"Makefile",
		"settings.json",
		"page.mdx",
		"run.mjs",
	])("accepts %s", (name) => {
		expect(isCodeFile(name)).toBe(true);
	});
});
