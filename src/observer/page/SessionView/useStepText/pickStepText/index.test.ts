import { describe, expect, it } from "vitest";
import pickStepText from "./index.js";

const PLAN = ["### 1. Retire the old UI", "- [x] Delete components", "### 2. Types and routes", "- [ ] Add types", "- [ ] 2a. Parse routes"].join("\n");

describe("pickStepText", () => {
	it("is the heading text of the numbered step", () => {
		expect(pickStepText({ text: PLAN, step: 1 })).toBe("Retire the old UI");
		expect(pickStepText({ text: PLAN, step: 2 })).toBe("Types and routes");
	});

	it("is null for a step the plan does not have", () => {
		expect(pickStepText({ text: PLAN, step: 9 })).toBeNull();
		expect(pickStepText({ text: "", step: 1 })).toBeNull();
	});
});
