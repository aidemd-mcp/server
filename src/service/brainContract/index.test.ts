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

	it("lists the fourteen required sections in the committed order", () => {
		expect(brainContract.map((entry) => entry.marker)).toEqual([
			"orientation",
			"config",
			"playbook-index",
			"study-playbook",
			"update-playbook",
			"research-index",
			"kanban-index",
			"kanban-create",
			"kanban-work",
			"kanban-manage",
			"kanban-move",
			"kanban-complete",
			"kanban-stash",
			"kanban-review",
		]);
	});

	it.each([
		String.raw`\bvault\b`,
		String.raw`\bobsidian\b`,
		String.raw`\bnotes?\b`,
		"wikilink",
		String.raw`\bhubs?\b`,
		String.raw`\[\[`,
		"mcp__",
		"kanban-plugin",
	])("keeps backend vocabulary matching %s out of every purpose", (pattern) => {
		const banned = new RegExp(pattern, "i");
		for (const entry of brainContract) expect(entry.purpose).not.toMatch(banned);
	});

	it("seeds the kanban index at kanban/kanban.md and each operation guide under kanban/guide/", () => {
		const seedPaths = new Map<string, string>(
			brainContract.flatMap((entry) =>
				entry.role === "seed" ? [[entry.marker, entry.seedPath] as const] : [],
			),
		);
		expect(seedPaths.get("kanban-index")).toBe("kanban/kanban.md");
		const guides = [
			"kanban-create",
			"kanban-work",
			"kanban-manage",
			"kanban-move",
			"kanban-complete",
			"kanban-stash",
			"kanban-review",
		];
		for (const marker of guides)
			expect(seedPaths.get(marker)?.startsWith("kanban/guide/")).toBe(true);
	});
});
