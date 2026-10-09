import { describe, it, expect } from "vitest";
import composeOutdatedRemediation from "./index.js";
import type { BrainAideFault } from "@/types/index.js";

const MISSING: BrainAideFault = { kind: "missing-sections", sections: ["kanban-board", "kanban-index"] as never };
const MALFORMED: BrainAideFault = { kind: "malformed", reason: "unterminated marker `<!-- begin:orientation -->`" };

describe("composeOutdatedRemediation", () => {
	it("composes the exact missing-sections string, markers joined by ', ' in order", () => {
		expect(composeOutdatedRemediation(MISSING)).toBe(
			"`.aide/config/brain.aide` is missing required sections: kanban-board, kanban-index. Tell the user to run `/aide:brain config` — it adds only the missing sections from the latest bundled template and leaves every existing section untouched. Do not proceed with this task as if the brain were available.",
		);
	});

	it("composes the exact malformed string with the reason verbatim", () => {
		expect(composeOutdatedRemediation(MALFORMED)).toBe(
			"`.aide/config/brain.aide` exists but is malformed: unterminated marker `<!-- begin:orientation -->`. Tell the user to run `/aide:brain config` to repair it. Do not proceed with this task as if the brain were available.",
		);
	});

	it.each([MISSING, MALFORMED])("routes to /aide:brain config and never claims the file is absent ($kind)", (fault) => {
		const text = composeOutdatedRemediation(fault);
		expect(text).toContain("/aide:brain config");
		expect(text).not.toContain("not present");
		expect(text).not.toContain("missing .aide");
		expect(text).not.toContain("init");
		expect(text).not.toContain("sync");
	});
});
