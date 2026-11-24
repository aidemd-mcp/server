import { describe, expect, it } from "vitest";
import wantsHtml from "./index.js";

describe("wantsHtml", () => {
	it.each([
		["text/html"],
		["TEXT/HTML"],
		["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"],
		["application/json, text/html;q=0.5"],
		[" text/html ; charset=utf-8"],
	])("is true for %s", (accept) => {
		expect(wantsHtml({ accept })).toBe(true);
	});

	it.each([[undefined], [""], ["*/*"], ["application/json"], ["text/htmlx"], ["text/*"]])("is false for %s", (accept) => {
		expect(wantsHtml({ accept })).toBe(false);
	});
});
