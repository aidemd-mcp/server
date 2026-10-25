import { describe, it, expect } from "vitest";
import checkAlignment from "./index.js";

const spec = (frontmatter: string) => `---\n${frontmatter}\n---\nbody`;

describe("checkAlignment", () => {
	it.each([
		{ name: "alignment set", fileName: ".aide", content: spec("alignment: unreviewed"), expected: null },
		{ name: "legacy status counts", fileName: "intent.aide", content: spec("status: aligned"), expected: null },
		{
			name: "neither name on a named spec",
			fileName: "readme.aide",
			content: spec("description: x"),
			expected: { kind: "missing-alignment", message: "Missing alignment field in frontmatter (a new spec starts at alignment: unreviewed)" },
		},
		{
			name: "no frontmatter at all",
			fileName: ".aide",
			content: "Intent only",
			expected: { kind: "missing-alignment", message: "Missing alignment field in frontmatter (a new spec starts at alignment: unreviewed)" },
		},
		{
			name: "value outside the list",
			fileName: ".aide",
			content: spec("alignment: pending"),
			expected: { kind: "invalid-alignment", message: 'alignment value "pending" is not one of unreviewed, aligned, misaligned' },
		},
		{
			name: "both names",
			fileName: ".aide",
			content: spec("alignment: aligned\nstatus: aligned"),
			expected: { kind: "invalid-alignment", message: "Both alignment and the older status name are set; keep only alignment" },
		},
		{ name: "unparsable frontmatter", fileName: ".aide", content: "---\nalignment: [unclosed\n---\nbody", expected: null },
		{ name: "plan", fileName: "plan.aide", content: spec("status: proposed"), expected: null },
		{ name: "todo", fileName: "todo.aide", content: spec("description: x"), expected: null },
		{ name: "brief", fileName: "brief.aide", content: spec("description: x"), expected: null },
		{ name: "research", fileName: "research.aide", content: spec("description: x"), expected: null },
		{ name: "session", fileName: "session.aide", content: spec("description: x"), expected: null },
		{ name: "brain config", fileName: "brain.aide", content: spec("description: x"), expected: null },
	])("$name", ({ fileName, content, expected }) => {
		const warning = checkAlignment({ fileName, content, relativePath: "src/a/" + fileName });

		if (expected === null) return expect(warning).toBeNull();
		expect(warning).toEqual({ ...expected, path: "src/a/" + fileName });
	});
});
