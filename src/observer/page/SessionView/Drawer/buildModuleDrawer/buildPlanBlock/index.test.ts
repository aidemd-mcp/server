import { describe, expect, it } from "vitest";
import buildPlanBlock from "./index.js";

const PLAN = `---
status: approved
---

### 1. Add types

- [x] Add AlignmentWeight

### 2. Weights

- [x] 2a. Misaligned 3, unreviewed 2, aligned 1
- [ ] 2b. Unit tests for each weight

### 3. Wire it

- [ ] Wire weights into the ranking
`;

describe("buildPlanBlock", () => {
	it("lists the steps with their sub-steps, marks the first open step current and badges the status and count", () => {
		const block = buildPlanBlock({ text: PLAN, plan: { file: "p", status: "approved", done: 1, total: 3 } });
		expect(block).toEqual({
			heading: "Plan",
			icon: "step",
			badge: { text: "approved · 1/3", tone: "run" },
			type: "check",
			items: [
				{ no: "1", text: "Add types", done: true, sub: false, current: false },
				{ no: "", text: "Add AlignmentWeight", done: true, sub: true, current: false },
				{ no: "2", text: "Weights", done: false, sub: false, current: true },
				{ no: "2a", text: "Misaligned 3, unreviewed 2, aligned 1", done: true, sub: true, current: false },
				{ no: "2b", text: "Unit tests for each weight", done: false, sub: true, current: false },
				{ no: "3", text: "Wire it", done: false, sub: false, current: false },
				{ no: "", text: "Wire weights into the ranking", done: false, sub: true, current: false },
			],
		});
	});

	it("folds a checkbox that repeats its heading into the heading row", () => {
		const block = buildPlanBlock({ text: "### 1. Add types\n\n- [x] Add types\n", plan: null });
		expect(block).toMatchObject({ type: "check", items: [{ no: "1", text: "Add types", done: true, sub: false }] });
	});

	it("marks nothing current once every step is done", () => {
		const block = buildPlanBlock({ text: "### 1. A\n\n- [x] A\n", plan: { file: "p", status: "completed", done: 1, total: 1 } });
		expect(block).toMatchObject({ badge: { text: "completed · 1/1", tone: "done" }, items: [{ current: false }] });
	});

	it("badges just the count while the plan records no status, and nothing without a tree row", () => {
		expect(buildPlanBlock({ text: "### 1. A\n\n- [ ] A\n", plan: { file: "p", status: "unset", done: 0, total: 1 } })?.badge).toEqual({ text: "0/1", tone: "outline" });
		expect(buildPlanBlock({ text: "### 1. A\n\n- [ ] A\n", plan: null })?.badge).toBeNull();
	});

	it("is null for a plan with nothing to list", () => {
		expect(buildPlanBlock({ text: "---\nstatus: approved\n---\nno steps", plan: null })).toBeNull();
	});
});
