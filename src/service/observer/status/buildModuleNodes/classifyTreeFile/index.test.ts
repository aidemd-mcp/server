import { describe, it, expect } from "vitest";
import classifyTreeFile from "./index.js";

describe("classifyTreeFile", () => {
	it.each([
		[".aide/intent.aide", "intent"],
		["src/cli/.aide", "intent"],
		["src/cli/intent.aide", "intent"],
		["src/a/research.aide", "research"],
		["src/a/brief.aide", "brief"],
		["src/a/plan.aide", "plan"],
		[".aide/plan.aide", "plan"],
		["src/a/todo.aide", "todo"],
		[".aide/session.aide", "session"],
		["src/x/session.aide", "other"],
		[".aide/config/brain.aide", "other"],
		["src/a/handoff.aide", "other"],
		["src/a/anything.aide", "other"],
		["src\\a\\plan.aide", "plan"],
	])("classifies %s as %s", (file, kind) => {
		expect(classifyTreeFile(file)).toBe(kind);
	});
});
