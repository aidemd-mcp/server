import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import { parseBundledTemplate } from "@/service/install/provisionBrain/index.js";
import listContract from "./index.js";

describe("listContract", () => {
	it("lists the contract markers in contract order", () => {
		expect(listContract().sections.map((section) => section.marker)).toEqual(
			brainContract.map((entry) => entry.marker),
		);
	});

	it("gives each section exactly marker, role and purpose from its entry", () => {
		listContract().sections.forEach((section, index) => {
			const { marker, role, purpose } = brainContract[index];
			expect(section).toEqual({ marker, role, purpose });
			expect(Object.keys(section).sort()).toEqual(["marker", "purpose", "role"]);
		});
	});

	it("has no launcher entry", () => {
		expect(listContract().sections.some((section) => section.marker === ("launcher" as string))).toBe(false);
	});

	it("carries none of the bundled template's section text", () => {
		const serialized = JSON.stringify(listContract());
		const template = parseBundledTemplate();
		for (const entry of brainContract) {
			const firstLine = template[entry.field].split("\n").find((line) => line.trim() !== "");
			expect(firstLine).toBeDefined();
			expect(serialized).not.toContain(JSON.stringify(firstLine).slice(1, -1));
		}
	});

	it("returns equal listings on repeated calls", () => {
		expect(listContract()).toEqual(listContract());
	});
});
