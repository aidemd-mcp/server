import { describe, expect, it } from "vitest";
import readGovernedValue from "../readGovernedValue/index.js";
import rewriteFieldLine from "./index.js";
import type { EditSite, GovernedKind } from "../types/index.js";

type Writable = Extract<EditSite, { kind: "replace" | "insert" }>;

/** Reads the edit site for content and asserts it is writable. */
function siteOf(content: string, kind: GovernedKind): Writable {
	const read = readGovernedValue({ content, kind });
	if (read.status !== "ok") throw new Error("unparsable fixture");
	if (read.edit.kind === "none") throw new Error("fixture has no edit site");
	return read.edit;
}

/** Applies the same fixture with each line terminator and an optional BOM. */
const VARIANTS = [
	{ name: "LF", eol: "\n", bom: "" },
	{ name: "CRLF", eol: "\r\n", bom: "" },
	{ name: "BOM + LF", eol: "\n", bom: "﻿" },
	{ name: "BOM + CRLF", eol: "\r\n", bom: "﻿" },
];

/** Joins lines with the variant's terminator, BOM first. */
function build(lines: string[], eol: string, bom: string): string {
	return bom + lines.join(eol);
}

/** Splits on either terminator so line-for-line comparison ignores the variant. */
function linesOf(content: string): string[] {
	return content.split(/\r?\n/);
}

describe.each(VARIANTS)("rewriteFieldLine — $name", ({ eol, bom }) => {
	it("replace changes exactly one line", () => {
		const content = build(["---", "scope: src/x", "alignment: unreviewed", "---", "body", ""], eol, bom);
		const out = rewriteFieldLine({
			content,
			edit: siteOf(content, "intent-spec"),
			key: "alignment",
			value: "aligned",
		});
		const before = linesOf(content);
		const after = linesOf(out);
		expect(after).toHaveLength(before.length);
		const changed = after.flatMap((line, i) => (line === before[i] ? [] : [i]));
		expect(changed).toEqual([2]);
		expect(after[2]).toBe("alignment: aligned");
		expect(out.includes(eol)).toBe(true);
		expect(out.startsWith(bom)).toBe(true);
	});

	it("insert at the top adds exactly one line with the file's terminator", () => {
		const content = build(["---", "intent: x", "---", "body", ""], eol, bom);
		const out = rewriteFieldLine({
			content,
			edit: siteOf(content, "plan"),
			key: "status",
			value: "proposed",
		});
		const before = linesOf(content);
		const after = linesOf(out);
		expect(after).toHaveLength(before.length + 1);
		expect(after).toEqual([before[0], "status: proposed", ...before.slice(1)]);
		expect(out).toBe(content.replace(`---${eol}`, `---${eol}status: proposed${eol}`));
	});

	it("insert for an intent spec goes after the scope line", () => {
		const content = build(["---", "scope: src/x", "description: d", "---", ""], eol, bom);
		const out = rewriteFieldLine({
			content,
			edit: siteOf(content, "intent-spec"),
			key: "alignment",
			value: "unreviewed",
		});
		const before = linesOf(content);
		const after = linesOf(out);
		expect(after).toEqual([before[0], before[1], "alignment: unreviewed", ...before.slice(2)]);
	});
});

describe("rewriteFieldLine — legacy and comments", () => {
	it("turns a legacy status line into the alignment line and leaves no top-level status", () => {
		const content = "---\nscope: src/x\nstatus: aligned\n---\nbody\n";
		const out = rewriteFieldLine({
			content,
			edit: siteOf(content, "intent-spec"),
			key: "alignment",
			value: "misaligned",
		});
		expect(out).toBe("---\nscope: src/x\nalignment: misaligned\n---\nbody\n");
		expect(out).not.toMatch(/^status:/m);
	});

	it("drops a trailing comment on the replaced line and changes nothing else", () => {
		const content = "---\nstatus: proposed # waiting on review\nintent: >\n  keep\n---\n";
		const out = rewriteFieldLine({
			content,
			edit: siteOf(content, "plan"),
			key: "status",
			value: "approved",
		});
		expect(out).toBe("---\nstatus: approved\nintent: >\n  keep\n---\n");
	});

	it("inserts into an empty block at a caller-supplied site", () => {
		const content = "---\n---\nbody\n";
		const out = rewriteFieldLine({
			content,
			edit: { kind: "insert", at: 4, eol: "\n" },
			key: "status",
			value: "proposed",
		});
		expect(out).toBe("---\nstatus: proposed\n---\nbody\n");
	});
});
