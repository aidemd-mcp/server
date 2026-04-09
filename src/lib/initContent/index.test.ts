import { describe, it, expect } from "vitest";
import { getMethodology, getMethodologyMarker, getCommands } from "./index.js";

describe("getMethodology", () => {
	it("contains the idempotency marker at start and end", () => {
		const content = getMethodology();
		const marker = getMethodologyMarker();

		expect(content.startsWith(marker)).toBe(true);
		expect(content.endsWith(marker)).toBe(true);
	});

	it("contains key AIDE concepts", () => {
		const content = getMethodology();

		expect(content).toContain(".aide");
		expect(content).toContain("intent.aide");
		expect(content).toContain("research.aide");
		expect(content).toContain("todo.aide");
		expect(content).toContain("Progressive Disclosure");
		expect(content).toContain("Agent Pipeline");
	});

	it("references MCP tools", () => {
		const content = getMethodology();

		expect(content).toContain("aide_discover");
		expect(content).toContain("aide_read");
		expect(content).toContain("aide_scaffold");
		expect(content).toContain("aide_validate");
	});

	it("references slash commands", () => {
		const content = getMethodology();

		expect(content).toContain("/aide-research");
		expect(content).toContain("/aide-spec");
		expect(content).toContain("/aide-build");
		expect(content).toContain("/aide-qa");
		expect(content).toContain("/aide-fix");
	});
});

describe("getCommands", () => {
	it("returns all 5 command templates", () => {
		const commands = getCommands();

		expect(Object.keys(commands)).toHaveLength(5);
		expect(commands).toHaveProperty("aide-research.md");
		expect(commands).toHaveProperty("aide-spec.md");
		expect(commands).toHaveProperty("aide-build.md");
		expect(commands).toHaveProperty("aide-qa.md");
		expect(commands).toHaveProperty("aide-fix.md");
	});

	it("each command contains a checklist", () => {
		const commands = getCommands();

		for (const content of Object.values(commands)) {
			expect(content).toContain("## Checklist");
			expect(content).toContain("- [ ]");
		}
	});
});
