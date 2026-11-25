import { describe, it, expect } from "vitest";
import formatSessionTag from "@/service/observer/event/shared/formatSessionTag/index.js";
import parseSessionTag from "@/service/observer/event/shared/parseSessionTag/index.js";

const ID = "20261122T100000000Z-abc123";

describe("formatSessionTag", () => {
	it("builds the label and id in brackets", () => {
		expect(formatSessionTag(ID)).toBe(`[observer-session ${ID}]`);
	});

	it("round-trips through parseSessionTag", () => {
		expect(parseSessionTag(formatSessionTag(ID))).toBe(ID);
	});
});
