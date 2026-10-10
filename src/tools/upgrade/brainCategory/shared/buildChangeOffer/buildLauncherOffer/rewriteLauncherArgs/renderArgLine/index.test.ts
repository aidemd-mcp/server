import { describe, it, expect } from "vitest";
import renderArgLine from "./index.js";

describe("renderArgLine", () => {
	it("renders a single-quoted scalar in the given indentation and line ending", () => {
		expect(renderArgLine({ indent: "    ", value: "npx", eol: "\n" })).toBe("    - 'npx'\n");
		expect(renderArgLine({ indent: "  ", value: "-y", eol: "\r\n" })).toBe("  - '-y'\r\n");
	});

	it("doubles embedded single quotes", () => {
		expect(renderArgLine({ indent: "  ", value: "it's", eol: "\n" })).toBe("  - 'it''s'\n");
	});

	it("renders a bare dash for a null value", () => {
		expect(renderArgLine({ indent: "  ", value: null, eol: "\n" })).toBe("  -\n");
	});

	it("returns null for a value containing a line break", () => {
		expect(renderArgLine({ indent: "  ", value: "a\nb", eol: "\n" })).toBeNull();
		expect(renderArgLine({ indent: "  ", value: "a\rb", eol: "\n" })).toBeNull();
	});
});
