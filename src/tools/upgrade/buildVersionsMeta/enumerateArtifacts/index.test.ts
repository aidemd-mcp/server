import { describe, it, expect } from "vitest";

import enumerateArtifacts from "./index.js";

describe("enumerateArtifacts", () => {
	it("returns at least one entry from every category", () => {
		const entries = enumerateArtifacts();
		const slugs = entries.map((e) => e.slug);

		expect(slugs.some((s) => s.startsWith("docs/"))).toBe(true);
		expect(slugs.some((s) => s.startsWith("commands/"))).toBe(true);
		expect(slugs.some((s) => s.startsWith("agents/"))).toBe(true);
		expect(slugs.some((s) => s.startsWith("skills/"))).toBe(true);
		expect(slugs.some((s) => s.startsWith("bin/"))).toBe(true);
		expect(slugs.some((s) => s.startsWith("extensions/"))).toBe(true);
	});

	it("every entry has non-empty slug and repoPath strings", () => {
		const entries = enumerateArtifacts();

		for (const entry of entries) {
			expect(typeof entry.slug).toBe("string");
			expect(entry.slug.length).toBeGreaterThan(0);
			expect(typeof entry.repoPath).toBe("string");
			expect(entry.repoPath.length).toBeGreaterThan(0);
		}
	});

	it("slugs are unique across all categories", () => {
		const entries = enumerateArtifacts();
		const slugs = entries.map((e) => e.slug);
		const unique = new Set(slugs);

		expect(unique.size).toBe(slugs.length);
	});

	it("each slug starts with its category prefix", () => {
		const entries = enumerateArtifacts();
		const validPrefixes = ["docs/", "commands/", "agents/", "skills/", "bin/", "extensions/"];

		for (const entry of entries) {
			const hasValidPrefix = validPrefixes.some((prefix) => entry.slug.startsWith(prefix));
			expect(hasValidPrefix, `slug "${entry.slug}" does not start with a recognised category prefix`).toBe(true);
		}
	});
});
