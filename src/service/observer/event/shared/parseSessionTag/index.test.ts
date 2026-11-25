import { describe, it, expect } from "vitest";
import formatSessionTag from "@/service/observer/event/shared/formatSessionTag/index.js";
import parseSessionTag from "@/service/observer/event/shared/parseSessionTag/index.js";

const ID = "20261122T100000000Z-abc123";
const TAG = formatSessionTag(ID);

describe("parseSessionTag", () => {
	it("finds the tag at the end of a reply", () => {
		expect(parseSessionTag(`recorded ${TAG}`)).toBe(ID);
	});

	it("finds the tag inside a JSON-stringified MCP content array", () => {
		const response = JSON.stringify([{ type: "text", text: `recorded ${TAG}` }]);
		expect(parseSessionTag(response)).toBe(ID);
	});

	it("finds the tag inside escaped JSON text", () => {
		const escaped = JSON.stringify(JSON.stringify({ content: [{ text: `recorded ${TAG}` }] }));
		expect(parseSessionTag(escaped)).toBe(ID);
	});

	it("returns the first tag when the text carries several", () => {
		expect(parseSessionTag(`${TAG} then ${formatSessionTag("other-id")}`)).toBe(ID);
	});

	it.each([
		["a traversal id", "[observer-session ../x]"],
		["an id with a separator", "[observer-session a/b]"],
		["an id starting with a dot", "[observer-session .hidden]"],
		["an id over 128 characters", `[observer-session ${"a".repeat(129)}]`],
		["an empty id", "[observer-session ]"],
	])("ignores a tag with %s", (_name, text) => {
		expect(parseSessionTag(text)).toBeNull();
	});

	it("returns null when there is no tag", () => {
		expect(parseSessionTag("recorded")).toBeNull();
		expect(parseSessionTag("")).toBeNull();
	});

	it("returns null for a different label", () => {
		expect(parseSessionTag(`[other-label ${ID}]`)).toBeNull();
	});
});
