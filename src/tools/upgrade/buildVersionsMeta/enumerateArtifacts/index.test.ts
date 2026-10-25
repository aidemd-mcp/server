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

	it("includes the kanban-maintainer board agent under its canonical slug", () => {
		const entries = enumerateArtifacts();

		expect(entries).toContainEqual({
			slug: "agents/kanban/kanban-maintainer",
			repoPath: ".claude/agents/kanban/kanban-maintainer.md",
		});
	});

	it("includes the aide-upgrader agent and the changelog doc from the repo root", () => {
		const entries = enumerateArtifacts();

		expect(entries).toContainEqual({
			slug: "agents/aide/aide-upgrader",
			repoPath: ".claude/agents/aide/aide-upgrader.md",
		});
		expect(entries).toContainEqual({
			slug: "docs/changelog",
			repoPath: "CHANGELOG.md",
		});

		for (const entry of entries) {
			expect(entry.repoPath.replace(/\\/g, "/"), `repoPath "${entry.repoPath}" is the host copy of the changelog`).not.toBe(
				".aide/docs/changelog.md",
			);
		}
	});

	// The session record is user-owned state created by aide_scaffold; an artifact
	// entry would let aide_upgrade report it as drifted and offer an overwrite.
	it("never enumerates the project's session record as an artifact", () => {
		const entries = enumerateArtifacts();

		for (const entry of entries) {
			const repoPath = entry.repoPath.replace(/\\/g, "/");
			expect(repoPath, `repoPath "${entry.repoPath}" is the session record`).not.toBe(".aide/session.aide");
			expect(repoPath.endsWith("/session.aide"), `repoPath "${entry.repoPath}" is a session record`).toBe(false);
			expect(entry.slug, `slug "${entry.slug}" is the session record`).not.toBe("session");
			expect(entry.slug.endsWith("/session"), `slug "${entry.slug}" is a session record`).toBe(false);
		}

		expect(entries.map((e) => e.slug)).toContain("docs/session-aide");
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
