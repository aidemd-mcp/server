import { describe, it, expect } from "vitest";
import listTools from "./listTools/index.js";
import renderReadme from "./index.js";

const START = "<!-- aide-tools:start -->";
const END = "<!-- aide-tools:end -->";

const readme = [
	"# Title",
	"",
	"## Tools",
	"",
	START,
	"- stale line one",
	"- stale line two",
	END,
	"",
	"## Getting Started",
	"text",
	"",
].join("\n");

describe("renderReadme", () => {
	it("lists every tool exactly once between the markers", () => {
		const rendered = renderReadme({ readme });
		const inside = rendered.slice(rendered.indexOf(START) + START.length, rendered.indexOf(END));

		for (const { name } of listTools()) {
			expect(inside.split(`[\`${name}\`](`).length - 1).toBe(1);
			expect(rendered.split(`[\`${name}\`](`).length - 1).toBe(1);
		}
		expect(inside).not.toContain("stale");
	});

	it("leaves the bytes before the start marker and after the end marker unchanged", () => {
		const rendered = renderReadme({ readme });

		expect(rendered.slice(0, rendered.indexOf(START) + START.length)).toBe(
			readme.slice(0, readme.indexOf(START) + START.length),
		);
		expect(rendered.slice(rendered.indexOf(END))).toBe(readme.slice(readme.indexOf(END)));
	});

	it("returns the same string when run on its own output", () => {
		const rendered = renderReadme({ readme });

		expect(renderReadme({ readme: rendered })).toBe(rendered);
	});
});
