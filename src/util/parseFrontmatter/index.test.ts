import { describe, it, expect } from "vitest";
import parseFrontmatter from "./index.js";

describe("parseFrontmatter", () => {
	it("parses valid frontmatter with all fields", () => {
		const raw = `---
scope: cli
intent: Give developers a terminal-native way to explore the .aide tree.
outcomes:
  desired:
    - Two-panel layout
    - Keyboard navigation
  undesired:
    - A static dump
---

## Context

Body text here.
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).not.toBeNull();
		expect(result.frontmatter!.scope).toBe("cli");
		expect(result.frontmatter!.intent).toBe(
			"Give developers a terminal-native way to explore the .aide tree.",
		);
		expect(result.frontmatter!.outcomes!.desired).toEqual(["Two-panel layout", "Keyboard navigation"]);
		expect(result.frontmatter!.outcomes!.undesired).toEqual(["A static dump"]);
		expect(result.body.trim()).toBe("## Context\n\nBody text here.");
	});

	it("handles missing outcomes — returns empty arrays", () => {
		const raw = `---
scope: tools/discover
intent: Scan for .aide files.
---

Body content.
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).not.toBeNull();
		expect(result.frontmatter!.scope).toBe("tools/discover");
		expect(result.frontmatter!.outcomes).toBeUndefined();
		expect(result.body.trim()).toBe("Body content.");
	});

	it("handles partial outcomes — missing desired defaults to empty array", () => {
		const raw = `---
intent: Something
outcomes:
  undesired:
    - Bad thing
---
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter!.outcomes!.desired).toEqual([]);
		expect(result.frontmatter!.outcomes!.undesired).toEqual(["Bad thing"]);
	});

	it("handles partial outcomes — missing undesired defaults to empty array", () => {
		const raw = `---
intent: Something
outcomes:
  desired:
    - Good thing
---
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter!.outcomes!.desired).toEqual(["Good thing"]);
		expect(result.frontmatter!.outcomes!.undesired).toEqual([]);
	});

	it("returns null frontmatter and full raw string when no frontmatter block is present", () => {
		const raw = "## Context\n\nJust a body, no frontmatter.\n";

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).toBeNull();
		expect(result.body).toBe(raw);
	});

	it("handles frontmatter with no body — body is empty string", () => {
		const raw = `---
scope: .
intent: Root intent.
---
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).not.toBeNull();
		expect(result.frontmatter!.scope).toBe(".");
		expect(result.body).toBe("");
	});

	it("returns null frontmatter when YAML block is malformed", () => {
		const raw = `---
scope: [unclosed bracket
---

Body.
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).toBeNull();
		expect(result.body).toBe(raw);
	});

	it("handles multiline intent with YAML block scalar", () => {
		const raw = `---
intent: >
  This is a multiline
  intent statement.
---

Body here.
`;

		const result = parseFrontmatter(raw);

		expect(result.frontmatter).not.toBeNull();
		expect(result.frontmatter!.intent).toContain("This is a multiline");
	});
});
