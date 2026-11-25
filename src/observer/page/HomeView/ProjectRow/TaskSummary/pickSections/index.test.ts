import { describe, expect, it } from "vitest";
import pickSections from "./index.js";

describe("pickSections", () => {
	it("drops the frontmatter and the # title, then splits on ## headings", () => {
		const note = "---\ntitle: x\npriority: p1\n---\n# Fix the login\n\n## Goal\nMake login work.\n\n## Plan\n- step one\n- step two\n";
		expect(pickSections(note)).toEqual([
			{ heading: "Goal", preview: "Make login work.", markdown: "Make login work." },
			{ heading: "Plan", preview: "step one", markdown: "- step one\n- step two" },
		]);
	});

	it("calls the text before the first ## heading Summary", () => {
		expect(pickSections("# Title\nIntro text.\n\n## Next\nMore.")).toEqual([
			{ heading: "Summary", preview: "Intro text.", markdown: "Intro text." },
			{ heading: "Next", preview: "More.", markdown: "More." },
		]);
	});

	it("leaves out empty sections", () => {
		expect(pickSections("## Empty\n\n## Full\ntext")).toEqual([{ heading: "Full", preview: "text", markdown: "text" }]);
	});

	it("strips list and checkbox markers and inline markup from the preview, and skips a leading code fence line", () => {
		expect(pickSections("## A\n- [x] **done** `thing`")[0]?.preview).toBe("done thing");
		expect(pickSections("## B\n1. first\n2. second")[0]?.preview).toBe("first");
		expect(pickSections("## C\n```\ncode line\n```")[0]?.preview).toBe("code line");
	});

	it("keeps ### sub-headings inside their section", () => {
		const sections = pickSections("## Outer\ntext\n### Inner\nmore");
		expect(sections).toHaveLength(1);
		expect(sections[0]?.markdown).toBe("text\n### Inner\nmore");
	});

	it("accepts CRLF and returns nothing for an empty note", () => {
		expect(pickSections("## A\r\nline\r\n")).toEqual([{ heading: "A", preview: "line", markdown: "line" }]);
		expect(pickSections("")).toEqual([]);
		expect(pickSections("---\na: b\n---\n# Only a title\n")).toEqual([]);
	});
});
