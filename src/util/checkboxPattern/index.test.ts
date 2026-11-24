import { describe, it, expect } from "vitest";
import CHECKBOX_PATTERN from "./index.js";

describe("CHECKBOX_PATTERN", () => {
	it.each(["- [ ] item", "* [ ] item", "+ [ ] item", "1. [ ] item", "2) [ ] item", "    - [ ] item"])(
		"matches an open checkbox in %j",
		(line) => {
			const match = CHECKBOX_PATTERN.exec(line);
			expect(match?.[1]).toBe(" ");
			expect(match?.[2]?.trim()).toBe("item");
		},
	);

	it.each(["- [x] done", "- [X] done"])("reports %j as checked", (line) => {
		expect(CHECKBOX_PATTERN.exec(line)?.[1]).not.toBe(" ");
	});

	it.each(["plain text", "- item", "## [ ] heading"])("rejects %j", (line) => {
		expect(CHECKBOX_PATTERN.exec(line)).toBeNull();
	});
});
