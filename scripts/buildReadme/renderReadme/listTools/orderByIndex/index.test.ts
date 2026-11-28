import { describe, it, expect } from "vitest";
import orderByIndex from "./index.js";

const tool = (name: string) => ({ name, description: `${name} description` });
const index = "| Tool | What |\n|---|---|\n| [b](./b.md) | x |\n| [a](./a.md) | y |\n| [c](./c.md) | z |\n";

describe("orderByIndex", () => {
	it("returns tools in index order regardless of input order", () => {
		const result = orderByIndex({ indexPage: index, tools: [tool("c"), tool("a"), tool("b")] });
		expect(result.map((entry) => entry.name)).toEqual(["b", "a", "c"]);
	});

	it("refuses a duplicate index link, naming the tool", () => {
		const indexPage = `${index}| [a](./a.md) | again |\n`;
		expect(() => orderByIndex({ indexPage, tools: [tool("a"), tool("b"), tool("c")] })).toThrow(/more than once: a/);
	});

	it("refuses an index link with no page, naming the tool", () => {
		expect(() => orderByIndex({ indexPage: index, tools: [tool("a"), tool("b")] })).toThrow(/no page: c/);
	});

	it("refuses a page missing from the index, naming the tool", () => {
		expect(() => orderByIndex({ indexPage: index, tools: [tool("a"), tool("b"), tool("c"), tool("d")] })).toThrow(
			/does not link: d/,
		);
	});
});
