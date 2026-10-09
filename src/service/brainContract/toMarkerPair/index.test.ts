import { describe, it, expect } from "vitest";
import brainContract from "../index.js";
import toMarkerPair from "./index.js";

describe("toMarkerPair", () => {
	it("produces the exact bytes for orientation", () => {
		expect(toMarkerPair("orientation")).toEqual({
			open: "<!-- aide-orientation-start -->",
			close: "<!-- aide-orientation-end -->",
		});
	});

	it("produces the exact bytes for kanban-board", () => {
		expect(toMarkerPair("kanban-board")).toEqual({
			open: "<!-- aide-kanban-board-start -->",
			close: "<!-- aide-kanban-board-end -->",
		});
	});

	it("yields a distinct open/close pair for every contract entry", () => {
		const markers = brainContract.map((entry) => toMarkerPair(entry.marker));
		const all = markers.flatMap((pair) => [pair.open, pair.close]);
		expect(new Set(all).size).toBe(brainContract.length * 2);
	});

	it.each(brainContract.map((entry) => entry.marker))("open and close for %s differ only in start vs end", (marker) => {
		const { open, close } = toMarkerPair(marker);
		expect(open.replace("-start -->", "-end -->")).toBe(close);
	});
});
