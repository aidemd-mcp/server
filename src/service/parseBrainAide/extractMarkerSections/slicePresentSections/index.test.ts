import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import locateMarkers from "../locateMarkers/index.js";
import sliceSections from "../sliceSections/index.js";
import slicePresentSections from "./index.js";

function makeBody(omit: BrainSectionMarker[] = []): string {
	return brainContract
		.filter(({ marker }) => !omit.includes(marker as BrainSectionMarker))
		.map(({ marker }) => {
			const { open, close } = toMarkerPair(marker as BrainSectionMarker);
			return `${open}\n  Some ${marker} content.\n\n${close}`;
		})
		.join("\n\n");
}

describe("slicePresentSections", () => {
	it("gives every field, byte-identical to sliceSections, when every pair is present", () => {
		const body = makeBody();
		const located = locateMarkers(body);

		expect(slicePresentSections({ body, located })).toEqual(sliceSections({ body, located }));
	});

	it("omits the fields of absent pairs and keeps the rest verbatim, whitespace and edge newlines included", () => {
		const omit: BrainSectionMarker[] = ["kanban-index", "kanban-create"];
		const body = makeBody(omit);

		const present = slicePresentSections({ body, located: locateMarkers(body) });

		expect(Object.keys(present)).not.toContain("kanbanIndex");
		expect(Object.keys(present)).not.toContain("kanbanCreate");
		for (const { marker, field } of brainContract.filter(({ marker }) => !omit.includes(marker as BrainSectionMarker))) {
			expect(present[field as keyof typeof present]).toBe(`\n  Some ${marker} content.\n\n`);
		}
		expect(Object.keys(present)).toHaveLength(brainContract.length - omit.length);
	});

	it("gives an empty record for an empty body", () => {
		expect(slicePresentSections({ body: "", located: [] })).toEqual({});
	});
});
