import { describe, expect, it } from "vitest";
import type { BoardTask } from "@/types/index.js";
import buildTaskCard from "./index.js";

const readable: BoardTask = { state: "readable", slug: "fix-login", column: "todo", title: "Fix the login bug", priority: "p1", type: "bug", tags: [], inSession: false };
const unreadable: BoardTask = { state: "unreadable", slug: "broken-note", column: "backlog", reason: "frontmatter is not valid YAML", inSession: false };

describe("buildTaskCard", () => {
	it("gives a readable note its title, priority and type", () => {
		expect(buildTaskCard({ task: readable, linked: false })).toEqual({
			slug: "fix-login",
			title: "Fix the login bug",
			priority: "p1",
			type: "bug",
			linked: false,
			unreadable: null,
		});
	});

	it("leaves the type null when the note has none", () => {
		const { type: _type, ...untyped } = readable as Extract<BoardTask, { state: "readable" }>;
		expect(buildTaskCard({ task: untyped as BoardTask, linked: false }).type).toBeNull();
	});

	it("keeps an unreadable note's slug as the title and carries the observer's reason", () => {
		expect(buildTaskCard({ task: unreadable, linked: false })).toEqual({
			slug: "broken-note",
			title: "broken-note",
			priority: null,
			type: null,
			linked: false,
			unreadable: "frontmatter is not valid YAML",
		});
	});

	it("carries the linked flag it is given on either kind of note", () => {
		expect(buildTaskCard({ task: readable, linked: true }).linked).toBe(true);
		expect(buildTaskCard({ task: unreadable, linked: true }).linked).toBe(true);
	});
});
