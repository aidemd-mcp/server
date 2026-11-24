import { describe, it, expect } from "vitest";
import countPlanSteps from "./index.js";

const THREE_STEPS = [
	"## Plan",
	"",
	"### 1. One",
	"- [x] a",
	"### 2. Two",
	"- [x] a",
	"- [x] b",
	"### 3. Three",
	"- [x] a",
	"- [ ] b",
].join("\n");

describe("countPlanSteps", () => {
	it("counts a step done only when all its boxes are checked", () => {
		expect(countPlanSteps(THREE_STEPS)).toEqual({ done: 2, total: 3 });
	});

	it("counts lettered sub-steps inside their step", () => {
		const content = ["## Plan", "### 1. One", "- [x] 1a. done", "### 2. Two", "- [x] 2a. done", "- [ ] 2b. open"].join("\n");
		expect(countPlanSteps(content)).toEqual({ done: 1, total: 2 });
	});

	it("ends the plan section at the next ## heading", () => {
		const content = [THREE_STEPS, "", "## Decisions", "### 4. Not a step", "- [ ] nope"].join("\n");
		expect(countPlanSteps(content)).toEqual({ done: 2, total: 3 });
	});

	it("does not count a step with no checkboxes as done", () => {
		const content = ["## Plan", "### 1. One", "no boxes", "### 2. Two", "- [x] a"].join("\n");
		expect(countPlanSteps(content)).toEqual({ done: 1, total: 2 });
	});

	it("falls back to checkbox counts when there are no numbered headings", () => {
		const content = ["## Plan", "- [x] a", "- [x] b", "- [ ] c"].join("\n");
		expect(countPlanSteps(content)).toEqual({ done: 2, total: 3 });
	});

	it("handles CRLF content", () => {
		expect(countPlanSteps(THREE_STEPS.replace(/\n/g, "\r\n"))).toEqual({ done: 2, total: 3 });
	});
});
