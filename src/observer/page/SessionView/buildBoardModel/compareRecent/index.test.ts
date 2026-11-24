import { describe, expect, it } from "vitest";
import type { BoardTask } from "@/types/index.js";
import compareRecent from "./index.js";

function task({ slug, updated }: { slug: string; updated?: string }): BoardTask {
	return { state: "readable", slug, column: "done", title: slug, priority: "p2", tags: [], inSession: false, ...(updated === undefined ? {} : { updated }) };
}

describe("compareRecent", () => {
	it("puts the newer updated value first", () => {
		const sorted = [task({ slug: "old", updated: "2026-01-01" }), task({ slug: "new", updated: "2026-03-01T10:00:00" })].sort(compareRecent);
		expect(sorted.map((entry) => entry.slug)).toEqual(["new", "old"]);
	});

	it("puts a task with no updated value, or one that does not parse, after every dated one", () => {
		const sorted = [task({ slug: "none" }), task({ slug: "junk", updated: "not a date" }), task({ slug: "dated", updated: "2025-01-01" })].sort(compareRecent);
		expect(sorted.map((entry) => entry.slug)).toEqual(["dated", "junk", "none"]);
	});

	it("falls back to the slug for equal times", () => {
		const sorted = [task({ slug: "b", updated: "2026-01-01" }), task({ slug: "a", updated: "2026-01-01" })].sort(compareRecent);
		expect(sorted.map((entry) => entry.slug)).toEqual(["a", "b"]);
	});

	it("sorts an unreadable note as undated", () => {
		const broken: BoardTask = { state: "unreadable", slug: "broken", column: "done", reason: "bad", inSession: false };
		const sorted = [broken, task({ slug: "dated", updated: "2026-01-01" })].sort(compareRecent);
		expect(sorted.map((entry) => entry.slug)).toEqual(["dated", "broken"]);
	});
});
