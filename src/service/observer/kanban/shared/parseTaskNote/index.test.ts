import { describe, expect, it } from "vitest";
import parseTaskNote from "./index.js";

/** Builds a task note from raw frontmatter lines and a body, with the requested line endings. */
function makeNote({
	frontmatter = "",
	body = "# Title\n",
	eol = "\n",
}: { frontmatter?: string; body?: string; eol?: string } = {}): string {
	return `---\n${frontmatter}\n---\n${body}`.replace(/\n/g, eol);
}

const REAL = "project: aidemd-mcp\npriority: p2\ntype: feature\ncreated: 2026-11-22T10:00:00\nupdated: 2026-11-22T11:30:00";

function parse(markdown: string, inSession = false) {
	return parseTaskNote({ slug: "my-task", column: "todo", markdown, inSession });
}

describe("parseTaskNote", () => {
	it("parses the real task shape", () => {
		expect(parse(makeNote({ frontmatter: REAL }))).toEqual({
			state: "readable",
			slug: "my-task",
			column: "todo",
			title: "Title",
			priority: "p2",
			type: "feature",
			tags: [],
			updated: "2026-11-22T11:30:00",
			inSession: false,
		});
	});

	it("defaults the priority to p2 when absent", () => {
		expect(parse(makeNote({ frontmatter: "type: bug" }))).toMatchObject({ priority: "p2" });
	});

	it("defaults an unknown priority to p2", () => {
		expect(parse(makeNote({ frontmatter: "priority: high" }))).toMatchObject({ priority: "p2" });
	});

	it("keeps a known priority", () => {
		expect(parse(makeNote({ frontmatter: "priority: p0" }))).toMatchObject({ priority: "p0" });
	});

	it("reads tags as a list", () => {
		expect(parse(makeNote({ frontmatter: "tags: [a, b]" }))).toMatchObject({ tags: ["a", "b"] });
	});

	it("reads a single tag string and strips a leading #", () => {
		expect(parse(makeNote({ frontmatter: 'tags: "#a"' }))).toMatchObject({ tags: ["a"] });
	});

	it("uses the slug as the title when there is no # heading", () => {
		expect(parse(makeNote({ frontmatter: REAL, body: "just text\n" }))).toMatchObject({ title: "my-task" });
	});

	it("omits type and updated when absent", () => {
		const task = parse(makeNote({ frontmatter: "priority: p1" }));
		expect(task).not.toHaveProperty("type");
		expect(task).not.toHaveProperty("updated");
	});

	it("is unreadable without frontmatter", () => {
		expect(parse("# Title\n")).toMatchObject({ state: "unreadable", reason: "no frontmatter" });
	});

	it("is unreadable with broken YAML, carrying the parser message", () => {
		const task = parse(makeNote({ frontmatter: "priority: [p1" }));
		expect(task).toMatchObject({ state: "unreadable" });
		expect(task.state === "unreadable" && task.reason).toMatch(/^frontmatter does not parse: .+/);
	});

	it("is unreadable when the frontmatter is a list", () => {
		expect(parse(makeNote({ frontmatter: "- a" }))).toMatchObject({
			state: "unreadable",
			reason: "frontmatter is not a mapping",
		});
	});

	it("parses CRLF the same as LF", () => {
		expect(parse(makeNote({ frontmatter: REAL, eol: "\r\n" }))).toEqual(parse(makeNote({ frontmatter: REAL })));
	});

	it.each([true, false])("carries inSession=%s through both states", (inSession) => {
		expect(parse(makeNote({ frontmatter: REAL }), inSession)).toMatchObject({ state: "readable", inSession });
		expect(parse("no block", inSession)).toMatchObject({ state: "unreadable", inSession });
	});
});
