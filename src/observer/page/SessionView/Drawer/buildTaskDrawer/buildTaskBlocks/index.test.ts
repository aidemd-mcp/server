import { describe, expect, it } from "vitest";
import buildTaskBlocks from "./index.js";

const NOTE = `---
priority: p1
type: bug
---
# aide_score ranks misaligned specs below unreviewed ones

aide_score sorts by modification time.

## Acceptance

- Misaligned > unreviewed > aligned
- Ties by open todo count

## Empty

`;

describe("buildTaskBlocks", () => {
	it("calls the text before the first heading the description, without the title line", () => {
		expect(buildTaskBlocks({ markdown: NOTE })[0]).toEqual({
			heading: "Description",
			icon: "doc",
			badge: null,
			type: "text",
			paras: ["aide_score sorts by modification time."],
		});
	});

	it("draws each section under its heading, a list section as a list, and skips an empty one", () => {
		const blocks = buildTaskBlocks({ markdown: NOTE });
		expect(blocks).toHaveLength(2);
		expect(blocks[1]).toEqual({
			heading: "Acceptance",
			icon: "list",
			badge: null,
			type: "list",
			items: ["Misaligned > unreviewed > aligned", "Ties by open todo count"],
		});
	});

	it("has no description block for a note that is only a title", () => {
		expect(buildTaskBlocks({ markdown: "# Just a title\n" })).toEqual([]);
	});
});
