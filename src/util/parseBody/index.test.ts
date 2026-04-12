import { describe, it, expect } from "vitest";
import parseBody from "./index.js";

describe("parseBody", () => {
	it("splits body into sections by ## headings", () => {
		const body = `## Context

Some context here. More details follow.

## Strategy

The strategy is to do things well.

## Good examples

Here is a good example.
`;

		const sections = parseBody(body);

		expect(sections).toHaveLength(3);
		expect(sections[0].heading).toBe("Context");
		expect(sections[1].heading).toBe("Strategy");
		expect(sections[2].heading).toBe("Good examples");
	});

	it("captures full content between headings", () => {
		const body = `## Context

First paragraph.

Second paragraph.
`;

		const sections = parseBody(body);

		expect(sections).toHaveLength(1);
		expect(sections[0].content).toContain("First paragraph.");
		expect(sections[0].content).toContain("Second paragraph.");
	});

	it("generates a first-sentence summary when content ends with punctuation", () => {
		const body = `## Context

This is the first sentence. This is the second sentence.
`;

		const sections = parseBody(body);

		expect(sections[0].summary).toBe("This is the first sentence.");
	});

	it("generates a paragraph-count summary when content has multiple paragraphs and no sentence break", () => {
		const body = `## Strategy

First paragraph of prose without a period

Second paragraph of prose without a period
`;

		const sections = parseBody(body);

		expect(sections[0].summary).toBe("2 paragraphs");
	});

	it("handles body with no headings — returns single unnamed section", () => {
		const body = "Just some content with no headings at all.\n";

		const sections = parseBody(body);

		expect(sections).toHaveLength(1);
		expect(sections[0].heading).toBe("");
		expect(sections[0].content).toContain("Just some content");
	});

	it("handles empty body — returns empty array", () => {
		const sections = parseBody("");

		expect(sections).toHaveLength(0);
	});

	it("handles body with only whitespace — returns empty array", () => {
		const sections = parseBody("   \n\n   \n");

		expect(sections).toHaveLength(0);
	});

	it("recognizes the four canonical AIDE section names generically", () => {
		const body = `## Context

Context content.

## Strategy

Strategy content.

## Good examples

Good example content.

## Bad examples

Bad example content.
`;

		const sections = parseBody(body);

		const headings = sections.map((s) => s.heading);
		expect(headings).toEqual(["Context", "Strategy", "Good examples", "Bad examples"]);
	});

	it("handles arbitrary heading names — not limited to canonical sections", () => {
		const body = `## Setup

Setup steps.

## Decisions

Design decisions here.
`;

		const sections = parseBody(body);

		expect(sections[0].heading).toBe("Setup");
		expect(sections[1].heading).toBe("Decisions");
	});

	it("trims leading/trailing whitespace from section content", () => {
		const body = `## Context

   Content with surrounding whitespace.

`;

		const sections = parseBody(body);

		expect(sections[0].content).toBe("Content with surrounding whitespace.");
	});
});
