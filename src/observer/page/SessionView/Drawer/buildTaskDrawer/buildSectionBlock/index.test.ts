import { describe, expect, it } from "vitest";
import buildSectionBlock from "./index.js";

describe("buildSectionBlock", () => {
	it("is a list when the section is only bullets", () => {
		expect(buildSectionBlock({ heading: "Acceptance", content: "- Misaligned first\n- Ties by path" })).toEqual({
			heading: "Acceptance",
			icon: "list",
			badge: null,
			type: "list",
			items: ["Misaligned first", "Ties by path"],
		});
	});

	it("is paragraphs when the section holds prose", () => {
		expect(buildSectionBlock({ heading: "Notes", content: "First para\nstill first.\n\nSecond para." })).toEqual({
			heading: "Notes",
			icon: "doc",
			badge: null,
			type: "text",
			paras: ["First para still first.", "Second para."],
		});
	});

	it("keeps a list among prose as paragraphs of its own", () => {
		expect(buildSectionBlock({ heading: "Notes", content: "Intro.\n\n- a\n- b" })).toMatchObject({ type: "text", paras: ["Intro.", "a", "b"] });
	});

	it("renders a section holding a table as markdown, so the table draws as one", () => {
		const content = "Plans:\n\n| # | Plan |\n|---|---|\n| 1 | types |";
		expect(buildSectionBlock({ heading: "Plans", content })).toEqual({ heading: "Plans", icon: "doc", badge: null, type: "md", markdown: content });
	});

	it("is null for a section with no text", () => {
		expect(buildSectionBlock({ heading: "Empty", content: " \n" })).toBeNull();
	});
});
