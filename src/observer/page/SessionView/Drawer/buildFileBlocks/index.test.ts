import { describe, expect, it } from "vitest";
import buildFileBlocks from "./index.js";

const SPEC = `---
scope: src/tools/score
status: approved
count: 3
empty:
outcomes:
  desired:
    - Misaligned specs rank first
    - Ties break by path
  undesired:
    - Ranking depends on file order
tags:
  - a: 1
---

Preamble text.

## Context

Agents call aide_score.

## Strategy

\`\`\`
src/
  index.ts
\`\`\`

## Empty

`;

describe("buildFileBlocks", () => {
	it("draws every frontmatter field as one table, a list for arrays and one dotted row per nested key", () => {
		const [fm] = buildFileBlocks({ text: SPEC });
		expect(fm).toEqual({
			heading: "Frontmatter",
			icon: "doc",
			badge: null,
			type: "fm",
			rows: [
				{ key: "scope", value: "src/tools/score", list: null },
				{ key: "status", value: "approved", list: null },
				{ key: "count", value: "3", list: null },
				{ key: "empty", value: "", list: null },
				{ key: "outcomes.desired", value: "", list: ["Misaligned specs rank first", "Ties break by path"] },
				{ key: "outcomes.undesired", value: "", list: ["Ranking depends on file order"] },
				{ key: "tags", value: "", list: ['{"a":1}'] },
			],
		});
	});

	it("draws text before the first `##` as a Body block, then each `##` section as its own markdown block under its heading", () => {
		const blocks = buildFileBlocks({ text: SPEC });
		expect(blocks.map((block) => block.heading)).toEqual(["Frontmatter", "Body", "Context", "Strategy", "Empty"]);
		expect(blocks[1]).toMatchObject({ icon: "list", badge: null, type: "md" });
		expect((blocks[1] as { markdown: string }).markdown).toContain("Preamble text.");
		expect((blocks[2] as { markdown: string }).markdown.trim()).toBe("Agents call aide_score.");
	});

	it("keeps a section's code block as it was written, so a plan's tree keeps its layout", () => {
		const strategy = buildFileBlocks({ text: SPEC })[3] as { markdown: string };
		expect(strategy.markdown).toContain("```\nsrc/\n  index.ts\n```");
	});

	it("says (empty) for a section with no body", () => {
		expect(buildFileBlocks({ text: SPEC }).at(-1)).toEqual({ heading: "Empty", icon: "list", badge: null, type: "md", markdown: "(empty)" });
	});

	it("draws a file with no frontmatter as its body only, with no Body block when it starts at a `##`", () => {
		expect(buildFileBlocks({ text: "## Retro\n\n- lesson\n" }).map((block) => block.heading)).toEqual(["Retro"]);
		expect(buildFileBlocks({ text: "- [ ] a — b\n" })).toEqual([{ heading: "Body", icon: "list", badge: null, type: "md", markdown: "- [ ] a — b\n" }]);
	});

	it("reads CRLF files like LF ones", () => {
		const blocks = buildFileBlocks({ text: "---\r\nscope: a\r\n---\r\n\r\n## Context\r\n\r\nWhy.\r\n" });
		expect(blocks.map((block) => block.heading)).toEqual(["Frontmatter", "Context"]);
		expect(blocks[0]).toMatchObject({ rows: [{ key: "scope", value: "a", list: null }] });
	});

	it("draws no Frontmatter block for an empty frontmatter", () => {
		expect(buildFileBlocks({ text: "---\n\n---\n\n## A\n\nb\n" }).map((block) => block.heading)).toEqual(["A"]);
	});

	it("shows frontmatter it cannot parse as text with the parser's message, and still draws the body", () => {
		const blocks = buildFileBlocks({ text: "---\nkey: [unclosed\n---\n\n## A\n\nb\n" });
		expect(blocks.map((block) => block.heading)).toEqual(["Frontmatter (could not be read)", "A"]);
		expect(blocks[0]).toMatchObject({ icon: "error", type: "pre" });
		expect((blocks[0] as { text: string }).text).toContain("key: [unclosed");
	});

	it("is empty for an empty file", () => {
		expect(buildFileBlocks({ text: "" })).toEqual([]);
	});
});
