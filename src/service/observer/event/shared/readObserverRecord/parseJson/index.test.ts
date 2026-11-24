import { describe, it, expect } from "vitest";
import parseJson from "@/service/observer/event/shared/readObserverRecord/parseJson/index.js";

describe("parseJson", () => {
	it("returns the parsed value for valid JSON", () => {
		expect(parseJson('{"pid":1}')).toEqual({ pid: 1 });
	});

	it("returns undefined for invalid JSON", () => {
		expect(parseJson("{not json")).toBeUndefined();
	});

	it("returns undefined for empty text", () => {
		expect(parseJson("")).toBeUndefined();
	});
});
