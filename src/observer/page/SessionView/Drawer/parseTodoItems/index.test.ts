import { describe, expect, it } from "vitest";
import parseTodoItems from "./index.js";

const TODO = `---
status: approved
---

## Issues

- [x] **src/tools/score/index.ts:42** — Path argument is ignored.
      Traces to: \`outcomes.desired[1]\`
- [ ] **src/tools/score/index.ts:87** — Error thrown without a code.
- [ ] A line with no location

## Retro

What would have caught this earlier?

- A check of the error codes at plan time.
`;

describe("parseTodoItems", () => {
	it("reads each checkbox as an item with the text before the dash as its location", () => {
		const { items } = parseTodoItems(TODO);
		expect(items).toEqual([
			{ number: null, loc: "src/tools/score/index.ts:42", text: "Path argument is ignored.", done: true, sub: false },
			{ number: null, loc: "src/tools/score/index.ts:87", text: "Error thrown without a code.", done: false, sub: false },
			{ number: null, loc: null, text: "A line with no location", done: false, sub: false },
		]);
	});

	it("returns the retro section's markdown and keeps its list out of the items", () => {
		const { retro } = parseTodoItems(TODO);
		expect(retro).toBe("What would have caught this earlier?\n\n- A check of the error codes at plan time.");
	});

	it("returns a null retro when the section is missing or empty", () => {
		expect(parseTodoItems("## Issues\n- [ ] a — b").retro).toBeNull();
		expect(parseTodoItems("## Issues\n- [ ] a — b\n## Retro\n\n").retro).toBeNull();
	});
});
