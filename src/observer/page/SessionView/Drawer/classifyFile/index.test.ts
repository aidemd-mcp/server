import { describe, expect, it } from "vitest";
import classifyFile from "./index.js";

describe("classifyFile", () => {
	it.each([
		["src/a/.aide", { folder: "src/a", kind: "spec" }],
		[".aide/intent.aide", { folder: ".", kind: "spec" }],
		["src/a/plan.aide", { folder: "src/a", kind: "plan" }],
		[".aide/plan.aide", { folder: ".", kind: "plan" }],
		["src/a/todo.aide", { folder: "src/a", kind: "todo" }],
		["src/a/brief.aide", { folder: "src/a", kind: "brief" }],
	])("reads %s as a module file", (path, expected) => {
		expect(classifyFile(path)).toEqual(expected);
	});

	it.each(["src/a/index.ts", ".aide/session.aide", ".aide/config/brain.aide", "constructor"])("leaves %s as a plain file", (path) => {
		expect(classifyFile(path)).toBeNull();
	});
});
