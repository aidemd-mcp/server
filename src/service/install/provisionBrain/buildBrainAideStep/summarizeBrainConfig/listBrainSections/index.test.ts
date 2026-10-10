import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import parseBundledTemplate from "../../../parseBundledTemplate/index.js";
import listBrainSections from "./index.js";

describe("listBrainSections", () => {
	const sections = listBrainSections();

	it("returns one entry per contract entry, in contract order", () => {
		expect(sections.map((s) => s.marker)).toEqual(brainContract.map((e) => e.marker));
		expect(sections.map((s) => s.role)).toEqual(brainContract.map((e) => e.role));
	});

	it("carries the contract seedPath on seed entries and no seedPath key on live entries", () => {
		for (const entry of brainContract) {
			const section = sections.find((s) => s.marker === entry.marker)!;
			if (entry.role === "seed") expect(section.seedPath).toBe(entry.seedPath);
			else expect("seedPath" in section).toBe(false);
		}
	});

	it("carries only marker, role, seedPath and templateBytes: no purpose, no field, no text", () => {
		for (const section of sections) {
			expect(Object.keys(section).every((key) => ["marker", "role", "seedPath", "templateBytes"].includes(key))).toBe(true);
			expect("purpose" in section).toBe(false);
			expect("field" in section).toBe(false);
		}
	});

	it("reports each templateBytes as the UTF-8 byte length of the parsed template section", () => {
		const template = parseBundledTemplate();
		for (const entry of brainContract) {
			const section = sections.find((s) => s.marker === entry.marker)!;
			expect(section.templateBytes).toBe(Buffer.byteLength(template[entry.field], "utf8"));
			expect(section.templateBytes).toBeGreaterThan(0);
		}
	});
});
