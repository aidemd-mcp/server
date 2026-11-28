import { describe, it, expect } from "vitest";
import spliceSection from "./index.js";

const START = "<!-- aide-tools:start -->";
const END = "<!-- aide-tools:end -->";

function makeReadme({ eol = "\n", inside = ["stale one", "stale two"] }: { eol?: string; inside?: string[] } = {}): string {
	return [
		"# Title  ",
		"",
		"## Tools   ",
		"",
		START,
		...inside,
		END,
		"",
		"## Getting Started  ",
		"Text with trailing spaces   ",
		"",
	].join(eol);
}

describe("spliceSection", () => {
	it("replaces only the inside, leaving bytes before the start marker and after the end marker identical", () => {
		const readme = makeReadme();
		const result = spliceSection({ readme, lines: ["- a", "- b"] });

		const before = readme.slice(0, readme.indexOf(START) + START.length);
		const after = readme.slice(readme.indexOf(END));
		expect(result.startsWith(before)).toBe(true);
		expect(result.endsWith(after)).toBe(true);
		expect(result).toBe(`${before}\n- a\n- b\n${after}`);
	});

	it("keeps CRLF outside and uses CRLF between generated lines for a CRLF readme", () => {
		const readme = makeReadme({ eol: "\r\n" });
		const result = spliceSection({ readme, lines: ["- a", "- b"] });

		expect(result).toContain(`${START}\r\n- a\r\n- b\r\n${END}`);
		expect(result.replace(/\r\n/g, "")).not.toContain("\n");
	});

	it("uses LF between generated lines for an LF readme", () => {
		const result = spliceSection({ readme: makeReadme(), lines: ["- a", "- b"] });

		expect(result).toContain(`${START}\n- a\n- b\n${END}`);
		expect(result).not.toContain("\r");
	});

	it("is idempotent when spliced again with the same lines", () => {
		const lines = ["- a", "- b"];
		const once = spliceSection({ readme: makeReadme(), lines });

		expect(spliceSection({ readme: once, lines })).toBe(once);
	});

	it("fully replaces old content inside the markers", () => {
		const result = spliceSection({ readme: makeReadme({ inside: ["stale 1", "stale 2", "stale 3"] }), lines: ["- fresh"] });

		expect(result).not.toContain("stale");
		expect(result).toContain(`${START}\n- fresh\n${END}`);
	});

	it("writes a single EOL inside the markers when there are no lines", () => {
		const result = spliceSection({ readme: makeReadme(), lines: [] });

		expect(result).toContain(`${START}\n${END}`);
	});

	it.each([
		["missing start", `text\n${END}\n`, START, "missing"],
		["missing end", `text\n${START}\n`, END, "missing"],
		["doubled start", `${START}\n${START}\n${END}\n`, START, "2 times"],
		["doubled end", `${START}\n${END}\n${END}\n`, END, "2 times"],
		["end before start", `${END}\n${START}\n`, END, "before"],
	])("refuses %s", (_label, readme, marker, problem) => {
		expect(() => spliceSection({ readme, lines: ["- a"] })).toThrow(marker);
		expect(() => spliceSection({ readme, lines: ["- a"] })).toThrow(problem);
	});
});
