import { describe, expect, it } from "vitest";
import parseSpecFile from "./index.js";

const SPEC = `---
scope: src/tools/score
alignment: aligned
intent: >
  Score each module against the playbook.
  Show evidence for every score.
outcomes:
  desired:
    - Returns a score per module.
    - Cites file and line.
  undesired:
    - Writes outside .aide/.
---

Lead text.

## Context

Why this exists.

## Strategy

- one
- two
`;

describe("parseSpecFile", () => {
	it("reads scope, folded intent, both outcome lists and the body sections", () => {
		const view = parseSpecFile(SPEC);
		expect(view).toEqual({
			scope: "src/tools/score",
			intent: "Score each module against the playbook. Show evidence for every score.",
			desired: ["Returns a score per module.", "Cites file and line."],
			undesired: ["Writes outside .aide/."],
			sections: [
				{ heading: "", markdown: "Lead text." },
				{ heading: "Context", markdown: "Why this exists." },
				{ heading: "Strategy", markdown: "- one\n- two" },
			],
		});
	});

	it("gives no sections for a frontmatter-only spec and empty lists for missing outcomes", () => {
		const view = parseSpecFile("---\nscope: src/x\nintent: Do x.\n---\n");
		expect(view).toEqual({ scope: "src/x", intent: "Do x.", desired: [], undesired: [], sections: [] });
	});

	it("returns the parser's message when the frontmatter is not valid YAML", () => {
		const view = parseSpecFile("---\nscope: [unclosed\n---\nbody");
		expect(view).toHaveProperty("error");
		expect((view as { error: string }).error.length).toBeGreaterThan(0);
	});

	it("returns an error for a file with no frontmatter block", () => {
		expect(parseSpecFile("just text")).toEqual({ error: "This file has no frontmatter block." });
	});
});
