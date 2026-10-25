import { describe, it, expect } from "vitest";
import { readCanonicalDoc } from "@/service/install/initContent/index.js";
import sessionTemplate from "./index.js";

const DRIFT_MESSAGE =
	"sessionTemplate drifted from the Placeholder block in .aide/docs/session-aide.md — change the template and the doc block together.";

const REQUIRED_HEADINGS = [
	"## State summary",
	"## Kanban",
	"## The architectural intent (what the specs say after the rewrite)",
	"## Anti-regression invariants future build phases must hold",
	"## Where this cycle stopped (CRITICAL READING)",
	"### What the next agent must do",
	"### What's already done and validated",
	"### What's left after the current cycle",
	"## Process discipline (permanent)",
	"## Open questions",
];

/** Lines of the first ```markdown fence under `## Placeholder` in the canonical doc. */
function collectPlaceholderLines(): string[] {
	const lines = readCanonicalDoc("session-aide").replace(/\r\n/g, "\n").split("\n");
	const heading = lines.indexOf("## Placeholder");
	const open = lines.indexOf("```markdown", heading + 1);
	const close = lines.indexOf("```", open + 1);
	if (heading === -1 || open === -1 || close === -1) {
		throw new Error("session-aide.md has no fenced markdown block under ## Placeholder");
	}
	return lines.slice(open + 1, close);
}

describe("sessionTemplate", () => {
	it("equals the fenced block under ## Placeholder in session-aide.md byte for byte", () => {
		expect(sessionTemplate, DRIFT_MESSAGE).toBe(collectPlaceholderLines().join("\n") + "\n");
	});

	it("leaves every section empty", () => {
		const body = sessionTemplate.split("\n").slice(sessionTemplate.split("\n").indexOf("# AIDE SESSION"));
		const afterParagraph = body.slice(body.findIndex((line) => line.startsWith("## ")));
		const nonBlank = afterParagraph.filter((line) => line.trim() !== "");
		expect(nonBlank.every((line) => line.startsWith("#")), DRIFT_MESSAGE).toBe(true);
	});

	it.each(REQUIRED_HEADINGS)("contains the heading %s exactly once", (heading) => {
		const count = sessionTemplate.split("\n").filter((line) => line === heading).length;
		expect(count, DRIFT_MESSAGE).toBe(1);
	});

	it("has no alignment or status key in its frontmatter", () => {
		const lines = sessionTemplate.split("\n");
		const frontmatter = lines.slice(1, lines.indexOf("---", 1));
		expect(frontmatter.some((line) => /^(alignment|status):/.test(line))).toBe(false);
	});

	it("uses LF line endings only", () => {
		expect(sessionTemplate).not.toContain("\r");
	});
});
