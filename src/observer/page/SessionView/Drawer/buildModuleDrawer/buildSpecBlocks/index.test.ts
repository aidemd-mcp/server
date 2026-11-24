import { describe, expect, it } from "vitest";
import buildSpecBlocks from "./index.js";

const SPEC = `---
scope: src/tools/score
intent: >
  Point the next agent at the module that most needs attention.
outcomes:
  desired:
    - Misaligned specs rank first
    - Ties break by path
  undesired:
    - Ranking depends on file order
---

## Context

Agents call aide_score at the start.
It sorts by modified time.

## Strategy

Compute a weight per node.
`;

describe("buildSpecBlocks", () => {
	it("draws intent and both outcome lists as frontmatter rows", () => {
		const [fm] = buildSpecBlocks({ text: SPEC });
		expect(fm).toEqual({
			heading: "Spec frontmatter",
			icon: "doc",
			badge: null,
			type: "fm",
			rows: [
				{ key: "intent", value: "Point the next agent at the module that most needs attention.", list: null },
				{ key: "desired", value: "", list: ["Misaligned specs rank first", "Ties break by path"] },
				{ key: "undesired", value: "", list: ["Ranking depends on file order"] },
			],
		});
	});

	it("draws each body section as one paragraph led by its heading", () => {
		const body = buildSpecBlocks({ text: SPEC })[1];
		expect(body).toEqual({
			heading: "Body",
			icon: "list",
			badge: null,
			type: "text",
			paras: ["Context — Agents call aide_score at the start. It sorts by modified time.", "Strategy — Compute a weight per node."],
		});
	});

	it("leaves out what the spec does not have", () => {
		expect(buildSpecBlocks({ text: "---\nscope: a\nintent: Only intent.\n---\n" })).toEqual([
			{ heading: "Spec frontmatter", icon: "doc", badge: null, type: "fm", rows: [{ key: "intent", value: "Only intent.", list: null }] },
		]);
	});

	it("says why a spec does not parse, in one block", () => {
		expect(buildSpecBlocks({ text: "no frontmatter here" })).toEqual([
			{ heading: "Spec frontmatter", icon: "doc", badge: null, type: "pre", text: "This file has no frontmatter block." },
		]);
	});
});
