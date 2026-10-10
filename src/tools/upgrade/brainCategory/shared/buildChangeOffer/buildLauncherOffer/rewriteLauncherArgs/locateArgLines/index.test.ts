import { describe, it, expect } from "vitest";
import locateArgLines from "./index.js";

const region = (argLines: string[]) => `name: brain\nmcpServerConfig:\n  command: cmd\n  args:\n${argLines.join("\n")}\nafter: kept\n`;

describe("locateArgLines", () => {
	it("returns the whole source line of each arg", () => {
		const frontmatter = region(["    - '/c'", "    - npx"]);
		const lines = locateArgLines({ frontmatter, expected: ["/c", "npx"] });

		expect(lines).not.toBeNull();
		expect(lines!.map((l) => frontmatter.slice(l.start, l.end))).toEqual(["    - '/c'\n", "    - npx\n"]);
		expect(lines!.map((l) => l.value)).toEqual(["/c", "npx"]);
	});

	it("locates a bare dash item as a null value", () => {
		const frontmatter = region(["    - 'a'", "    -"]);
		const lines = locateArgLines({ frontmatter, expected: ["a", null] });

		expect(lines!.map((l) => l.value)).toEqual(["a", null]);
	});

	it("returns null when a value differs from expected", () => {
		expect(locateArgLines({ frontmatter: region(["    - 'a'"]), expected: ["b"] })).toBeNull();
	});

	it("returns null when the item count differs from expected", () => {
		expect(locateArgLines({ frontmatter: region(["    - 'a'"]), expected: ["a", "b"] })).toBeNull();
	});

	it("returns null for a flow sequence", () => {
		const frontmatter = "mcpServerConfig:\n  args: ['a']\nafter: kept\n";
		expect(locateArgLines({ frontmatter, expected: ["a"] })).toBeNull();
	});

	it("returns null when mcpServerConfig is missing or args is not a sequence", () => {
		expect(locateArgLines({ frontmatter: "name: brain\n", expected: [] })).toBeNull();
		expect(locateArgLines({ frontmatter: "mcpServerConfig:\n  args: x\n", expected: ["x"] })).toBeNull();
	});

	it("returns null for unparsable YAML", () => {
		expect(locateArgLines({ frontmatter: "mcpServerConfig: [\n", expected: [] })).toBeNull();
	});

	it("returns null for a multi-line scalar item", () => {
		const frontmatter = region(["    - 'a", "      b'"]);
		expect(locateArgLines({ frontmatter, expected: ["a b"] })).toBeNull();
	});

	it("returns null when the final item has no trailing line break", () => {
		const frontmatter = "mcpServerConfig:\n  args:\n    - 'a'";
		expect(locateArgLines({ frontmatter, expected: ["a"] })).toBeNull();
	});
});
