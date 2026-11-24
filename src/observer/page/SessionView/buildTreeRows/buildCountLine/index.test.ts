import { describe, expect, it } from "vitest";
import buildCountLine from "./index.js";

const counts = { modules: 47, misaligned: 3, openWork: 10 };

describe("buildCountLine", () => {
	it("states what the project holds", () => {
		expect(buildCountLine({ counts, shown: 47 })).toBe("47 modules · 3 misaligned · 10 with open work");
	});

	it("adds how many are showing whenever fewer nodes are drawn than there are modules", () => {
		expect(buildCountLine({ counts, shown: 19 })).toBe("47 modules · 3 misaligned · 10 with open work · showing 19");
		expect(buildCountLine({ counts, shown: 0 })).toBe("47 modules · 3 misaligned · 10 with open work · showing 0");
	});

	it("does not say `showing` when every module is drawn", () => {
		expect(buildCountLine({ counts: { modules: 1, misaligned: 0, openWork: 0 }, shown: 1 })).toBe("1 modules · 0 misaligned · 0 with open work");
	});
});
