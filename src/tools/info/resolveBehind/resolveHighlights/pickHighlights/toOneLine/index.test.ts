import { describe, it, expect } from "vitest";
import toOneLine from "./index.js";

describe("toOneLine", () => {
	it.each([
		{
			name: "returns a one-sentence bullet unchanged",
			input: "Adds a board review command.",
			expected: "Adds a board review command.",
		},
		{
			name: "cuts at the first sentence end, keeping the period",
			input: "Implementors could skip entries. Now the architect writes the list.",
			expected: "Implementors could skip entries.",
		},
		{
			name: "removes bold markers",
			input: "**Brain config** now skips seeded files.",
			expected: "Brain config now skips seeded files.",
		},
		{
			name: "collapses inner newlines and double spaces",
			input: "Adds a  review\ncommand   for the\n board.",
			expected: "Adds a review command for the board.",
		},
		{
			name: "does not end the sentence at a period before a lowercase word",
			input: "Reads notes, e.g. the brain index, on boot.",
			expected: "Reads notes, e.g. the brain index, on boot.",
		},
		{
			name: "does not end the sentence at a period before a backtick",
			input: "Renames `a.` `b` in the config.",
			expected: "Renames `a.` `b` in the config.",
		},
		{
			name: "keeps backticks",
			input: "Adds `aide_info` highlights.",
			expected: "Adds `aide_info` highlights.",
		},
	])("$name", ({ input, expected }) => {
		expect(toOneLine(input)).toBe(expected);
	});

	it("caps a long single sentence at 120 characters, ending in an ellipsis, not cut mid-word", () => {
		const input = Array.from({ length: 40 }, () => "word").join(" ");
		expect(input.length).toBeGreaterThan(120);

		const result = toOneLine(input);

		expect(result.length).toBeLessThanOrEqual(120);
		expect(result.endsWith("…")).toBe(true);
		expect(
			result
				.slice(0, -1)
				.split(" ")
				.every((w) => w === "word"),
		).toBe(true);
	});
});
