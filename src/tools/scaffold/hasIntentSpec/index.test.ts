import { describe, it, expect } from "vitest";
import hasIntentSpec from "./index.js";

describe("hasIntentSpec", () => {
	it.each([
		[[".aide"], true],
		[["intent.aide", "research.aide"], true],
		[["research.aide"], false],
		[[], false],
		[["plan.aide", "todo.aide", "brief.aide", "session.aide"], false],
	] as const)("%j → %s", (existing, expected) => {
		expect(hasIntentSpec([...existing])).toBe(expected);
	});
});
