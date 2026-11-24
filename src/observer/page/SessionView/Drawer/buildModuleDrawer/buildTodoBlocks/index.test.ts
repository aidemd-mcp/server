import { describe, expect, it } from "vitest";
import buildTodoBlocks from "./index.js";

const TODO = `---
status: approved
---

- [ ] **src/tools/score/rank.ts:42** — Ties fall back to insertion order
- [x] **src/tools/score/weights.ts:9** — Weight table not frozen
- [ ] A line with no location

## Retro

- Round 1 missed tie-breaking.
- Golden fixture needs a misaligned leaf.
`;

describe("buildTodoBlocks", () => {
	it("draws the issues with a badge of how many are open", () => {
		const [issues] = buildTodoBlocks({ text: TODO });
		expect(issues).toEqual({
			heading: "Todo",
			icon: "issues",
			badge: { text: "2 of 3 open", tone: "danger" },
			type: "issues",
			items: [
				{ loc: "src/tools/score/rank.ts:42", text: "Ties fall back to insertion order", done: false },
				{ loc: "src/tools/score/weights.ts:9", text: "Weight table not frozen", done: true },
				{ loc: "", text: "A line with no location", done: false },
			],
		});
	});

	it("draws the retro as a list", () => {
		expect(buildTodoBlocks({ text: TODO })[1]).toEqual({
			heading: "Retro",
			icon: "history",
			badge: null,
			type: "list",
			items: ["Round 1 missed tie-breaking.", "Golden fixture needs a misaligned leaf."],
		});
	});

	it("tones the badge done when every issue is closed", () => {
		expect(buildTodoBlocks({ text: "- [x] a — b\n" })[0]).toMatchObject({ badge: { text: "0 of 1 open", tone: "done" } });
	});

	it("is empty for a todo with neither issues nor a retro", () => {
		expect(buildTodoBlocks({ text: "---\nstatus: approved\n---\n" })).toEqual([]);
	});
});
