import { describe, it, expect } from "vitest";
import brainContract from "./index.js";

const toCamelCase = (marker: string): string =>
	marker.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

describe("brainContract", () => {
	it("has unique kebab-case markers", () => {
		const markers = brainContract.map((entry) => entry.marker);
		expect(new Set(markers).size).toBe(markers.length);
		for (const marker of markers) expect(marker).toMatch(/^[a-z]+(-[a-z]+)*$/);
	});

	it("has unique fields that are the camelCase form of their marker", () => {
		const fields = brainContract.map((entry) => entry.field);
		expect(new Set(fields).size).toBe(fields.length);
		for (const entry of brainContract) expect(entry.field).toBe(toCamelCase(entry.marker));
	});

	it("gives every entry a non-empty one-line purpose", () => {
		for (const entry of brainContract) {
			expect(entry.purpose.trim().length).toBeGreaterThan(0);
			expect(entry.purpose).not.toMatch(/[\r\n]/);
		}
	});

	it("carries seedPath on, and only on, seed entries", () => {
		for (const entry of brainContract) {
			if (entry.role === "seed") expect(typeof entry.seedPath).toBe("string");
			else expect("seedPath" in entry).toBe(false);
		}
	});

	it("uses relative .md seed paths", () => {
		for (const entry of brainContract) {
			if (entry.role !== "seed") continue;
			expect(entry.seedPath.startsWith("/")).toBe(false);
			expect(entry.seedPath.endsWith(".md")).toBe(true);
		}
	});

	it("leads with the live orientation and config entries", () => {
		expect(brainContract[0]).toMatchObject({ marker: "orientation", role: "live" });
		expect(brainContract[1]).toMatchObject({ marker: "config", role: "live" });
	});

	it("lists the eight required sections in the committed order", () => {
		expect(brainContract.map((entry) => entry.marker)).toEqual([
			"orientation",
			"config",
			"playbook-index",
			"study-playbook",
			"update-playbook",
			"research-index",
			"kanban-board",
			"work-kanban",
		]);
	});
});
