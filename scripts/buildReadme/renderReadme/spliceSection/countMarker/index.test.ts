import { describe, it, expect } from "vitest";
import countMarker from "./index.js";

describe("countMarker", () => {
	it("returns 0 when the marker is absent", () => {
		expect(countMarker({ readme: "no markers here", marker: "<!-- m -->" })).toBe(0);
	});

	it("returns 1 for a single occurrence", () => {
		expect(countMarker({ readme: "a <!-- m --> b", marker: "<!-- m -->" })).toBe(1);
	});

	it("counts every occurrence", () => {
		expect(countMarker({ readme: "<!-- m --><!-- m -->\n<!-- m -->", marker: "<!-- m -->" })).toBe(3);
	});

	it("matches the marker exactly, not a near miss", () => {
		expect(countMarker({ readme: "<!-- M --> <!--m-->", marker: "<!-- m -->" })).toBe(0);
	});
});
