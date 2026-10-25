import { describe, it, expect } from "vitest";
import classifyAideFile from "./index.js";
import type { AideFileKind } from "../types/index.js";

describe("classifyAideFile", () => {
	it.each<[string, AideFileKind]>([
		[".aide", "intent-spec"],
		["intent.aide", "intent-spec"],
		["readme.aide", "intent-spec"],
		["plan.aide", "plan"],
		["todo.aide", "todo"],
		["brief.aide", "brief"],
		["research.aide", "research"],
		["session.aide", "session"],
		["handoff.aide", "session"],
		["brain.aide", "config"],
		["notes.md", "not-aide"],
		["plan.aide.bak", "not-aide"],
		["aide", "not-aide"],
		["", "not-aide"],
		["src/x/.aide", "intent-spec"],
		["src/x/plan.aide", "plan"],
		[".aide/session.aide", "session"],
		[".aide/config/brain.aide", "config"],
		["C:\\x\\plan.aide", "plan"],
		["C:\\x\\.aide", "intent-spec"],
		["src\\x\\notes.md", "not-aide"],
	])("classifies %j as %s", (name, expected) => {
		expect(classifyAideFile(name)).toBe(expected);
	});
});
