import { describe, it, expect } from "vitest";
import composeOutdatedRemediation from "./index.js";
import type { BrainAideFault } from "@/types/index.js";

const MISSING: BrainAideFault = { kind: "missing-sections", sections: ["kanban-board", "kanban-index"] as never };
const MALFORMED: BrainAideFault = { kind: "malformed", reason: "unterminated marker `<!-- begin:orientation -->`" };

describe("composeOutdatedRemediation", () => {
	it("composes the exact missing-sections string, markers joined by ', ' in order", () => {
		expect(composeOutdatedRemediation(MISSING)).toBe(
			"`.aide/config/brain.aide` is missing required sections: kanban-board, kanban-index. With the user's consent, call `aide_upgrade` with `category: \"brain\"` — it inserts only the missing sections and leaves every existing section untouched — then re-check brain state with `aide_info`.",
		);
	});

	it("composes the exact malformed string with the reason verbatim", () => {
		expect(composeOutdatedRemediation(MALFORMED)).toBe(
			"`.aide/config/brain.aide` exists but is malformed: unterminated marker `<!-- begin:orientation -->`. Fix it by hand with the user at the place that reason names, then re-check brain state with `aide_info`. Do not proceed with this task as if the brain were available.",
		);
	});

	it("missing-sections text names the aide_upgrade brain repair call", () => {
		const text = composeOutdatedRemediation(MISSING);
		expect(text).toContain("aide_upgrade");
		expect(text).toContain('category: "brain"');
	});

	it("malformed text carries the reason verbatim, a hand fix and the aide_info re-check", () => {
		const text = composeOutdatedRemediation(MALFORMED);
		expect(text).toContain("unterminated marker `<!-- begin:orientation -->`");
		expect(text).toContain("by hand");
		expect(text).toContain("aide_info");
	});

	it.each([MISSING, MALFORMED])("never names /aide:brain config and never claims the file is absent ($kind)", (fault) => {
		const text = composeOutdatedRemediation(fault);
		expect(text).not.toContain("/aide:brain config");
		expect(text).not.toMatch(/not present|absent/i);
		expect(text).not.toContain("missing .aide");
		expect(text).not.toContain("init");
		expect(text).not.toContain("sync");
	});
});
