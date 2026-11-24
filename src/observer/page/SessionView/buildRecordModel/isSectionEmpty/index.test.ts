import { describe, expect, it } from "vitest";
import isSectionEmpty from "./index.js";

describe("isSectionEmpty", () => {
	it("is empty when the section and every subsection hold only whitespace", () => {
		expect(isSectionEmpty({ heading: "A", markdown: " \n", subsections: [{ heading: "B", markdown: "" }] })).toBe(true);
	});

	it("is not empty when its own text or any subsection has text", () => {
		expect(isSectionEmpty({ heading: "A", markdown: "text", subsections: [] })).toBe(false);
		expect(isSectionEmpty({ heading: "A", markdown: "", subsections: [{ heading: "B", markdown: "- one" }] })).toBe(false);
	});
});
