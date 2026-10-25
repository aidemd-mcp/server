import { describe, expect, it } from "vitest";
import readGovernedValue from "./index.js";
import type { GovernedKind, GovernedRead } from "../types/index.js";

/** Reads content and asserts the read parsed, so tests can inspect the `ok` shape without narrowing noise. */
function readOk(content: string, kind: GovernedKind) {
	const read: GovernedRead = readGovernedValue({ content, kind });
	if (read.status !== "ok") throw new Error(`expected ok, got unparsable: ${read.detail}`);
	return read;
}

describe("readGovernedValue — intent spec alignment", () => {
	it("reads alignment and addresses exactly that line for replacement", () => {
		const content = "---\nscope: src/x\nalignment: aligned\n---\nbody\n";
		const read = readOk(content, "intent-spec");
		expect(read.field).toBe("alignment");
		expect(read.current).toEqual({ state: "set", value: "aligned" });
		expect(read.legacy).toBe(false);
		expect(read.ambiguous).toBe(false);
		expect(read.edit.kind).toBe("replace");
		if (read.edit.kind !== "replace") return;
		expect(content.slice(read.edit.start, read.edit.end)).toBe("alignment: aligned");
	});

	it("reads the older status name as the alignment and flags it legacy", () => {
		const content = "---\nscope: src/x\nstatus: misaligned\n---\n";
		const read = readOk(content, "intent-spec");
		expect(read.field).toBe("alignment");
		expect(read.current).toEqual({ state: "set", value: "misaligned" });
		expect(read.legacy).toBe(true);
		expect(read.ambiguous).toBe(false);
		if (read.edit.kind !== "replace") throw new Error("expected replace");
		expect(content.slice(read.edit.start, read.edit.end)).toBe("status: misaligned");
	});

	it("flags both names as ambiguous and takes current from alignment", () => {
		const content = "---\nalignment: unreviewed\nstatus: aligned\n---\n";
		const read = readOk(content, "intent-spec");
		expect(read.ambiguous).toBe(true);
		expect(read.legacy).toBe(false);
		expect(read.current).toEqual({ state: "set", value: "unreviewed" });
	});

	it.each([
		{
			name: "after a single-line scope when scope is the first key",
			content: "---\nscope: src/x\ndescription: d\n---\n",
			before: "---\nscope: src/x\n",
		},
		{
			name: "right after the opening --- when description is first",
			content: "---\ndescription: d\nscope: src/x\n---\n",
			before: "---\n",
		},
		{
			name: "right after the opening --- when scope is not single-line",
			content: "---\nscope: >\n  src/x\ndescription: d\n---\n",
			before: "---\n",
		},
		{
			name: "after scope when scope is the last line of the block",
			content: "---\nscope: src/x\n---\nbody\n",
			before: "---\nscope: src/x\n",
		},
	])("reports not-set with an insert site $name", ({ content, before }) => {
		const read = readOk(content, "intent-spec");
		expect(read.current).toEqual({ state: "not-set" });
		expect(read.legacy).toBe(false);
		expect(read.edit.kind).toBe("insert");
		if (read.edit.kind !== "insert") return;
		expect(content.slice(0, read.edit.at)).toBe(before);
		expect(read.edit.eol).toBe("\n");
	});

	it("reads an alignment value outside the set as invalid", () => {
		const read = readOk("---\nalignment: sideways\n---\n", "intent-spec");
		expect(read.current).toEqual({ state: "invalid", raw: "sideways" });
	});

	it("does not read an approved status on an intent spec as alignment", () => {
		const read = readOk("---\nstatus: approved\n---\n", "intent-spec");
		expect(read.current).toEqual({ state: "invalid", raw: "approved" });
		expect(read.legacy).toBe(true);
	});
});

describe("readGovernedValue — plan, todo and brief status", () => {
	it.each([
		{ kind: "plan", status: "approved" },
		{ kind: "todo", status: "approved" },
		{ kind: "brief", status: "proposed" },
		{ kind: "brief", status: "completed" },
	] as const)("reads $status on a $kind as set", ({ kind, status }) => {
		const read = readOk(`---\nstatus: ${status}\n---\n`, kind);
		expect(read.field).toBe("status");
		expect(read.current).toEqual({ state: "set", value: status });
		expect(read.legacy).toBe(false);
		expect(read.ambiguous).toBe(false);
		expect(read.edit.kind).toBe("replace");
	});

	it.each([
		{ kind: "plan", raw: "in-flight" },
		{ kind: "plan", raw: "aligned" },
		{ kind: "todo", raw: "in-flight" },
		{ kind: "brief", raw: "in-flight" },
	] as const)("reads $raw on a $kind as invalid", ({ kind, raw }) => {
		const read = readOk(`---\nstatus: ${raw}\n---\n`, kind);
		expect(read.current).toEqual({ state: "invalid", raw });
	});

	it.each(["plan", "todo", "brief"] as const)(
		"ignores an alignment key on a %s and reports status not-set",
		(kind) => {
			const content = "---\nintent: x\nalignment: aligned\n---\n";
			const read = readOk(content, kind);
			expect(read.field).toBe("status");
			expect(read.current).toEqual({ state: "not-set" });
			expect(read.legacy).toBe(false);
			expect(read.ambiguous).toBe(false);
			if (read.edit.kind !== "insert") throw new Error("expected insert");
			expect(content.slice(0, read.edit.at)).toBe("---\n");
		},
	);

	it("inserts right after the opening --- on a plan even when scope is first", () => {
		const content = "---\nscope: src/x\n---\n";
		const read = readOk(content, "plan");
		if (read.edit.kind !== "insert") throw new Error("expected insert");
		expect(content.slice(0, read.edit.at)).toBe("---\n");
	});
});

describe("readGovernedValue — value shapes", () => {
	it("reads a quoted value as set", () => {
		const read = readOk('---\nstatus: "approved"\n---\n', "plan");
		expect(read.current).toEqual({ state: "set", value: "approved" });
		expect(read.edit.kind).toBe("replace");
	});

	it("reads an empty value as invalid with raw empty text", () => {
		const read = readOk("---\nstatus:\nintent: x\n---\n", "plan");
		expect(read.current).toEqual({ state: "invalid", raw: "" });
		expect(read.edit.kind).toBe("replace");
	});

	it("reads a quoted invalid string as its parsed value, not the line text", () => {
		const read = readOk('---\nstatus: "in-flight"\n---\n', "plan");
		expect(read.current).toEqual({ state: "invalid", raw: "in-flight" });
		expect(read.edit.kind).toBe("replace");
	});

	it("reads an invalid string with a trailing comment as the parsed value without the comment", () => {
		const read = readOk("---\nstatus: in-flight # retired\n---\n", "plan");
		expect(read.current).toEqual({ state: "invalid", raw: "in-flight" });
	});

	it("keeps the line text for an invalid non-string value", () => {
		const read = readOk("---\nstatus: 42\n---\n", "plan");
		expect(read.current).toEqual({ state: "invalid", raw: "42" });
	});

	it("reads a folded block scalar as multi-line with no edit site", () => {
		const read = readOk("---\nstatus: >\n  approved\nintent: x\n---\n", "plan");
		expect(read.edit).toEqual({ kind: "none", reason: "multi-line" });
	});

	it("reads a value with an indented continuation as multi-line", () => {
		const read = readOk("---\nstatus:\n  approved\nintent: x\n---\n", "plan");
		expect(read.edit).toEqual({ kind: "none", reason: "multi-line" });
	});

	it("reads a quoted key as multi-line because no column-0 line holds it", () => {
		const read = readOk('---\n"status": approved\n---\n', "plan");
		expect(read.edit).toEqual({ kind: "none", reason: "multi-line" });
	});
});

describe("readGovernedValue — block recognition", () => {
	it.each(["intent-spec", "plan", "todo", "brief"] as const)(
		"treats a %s with no frontmatter as not-set and uneditable",
		(kind) => {
			const read = readOk("# just a body\n", kind);
			expect(read.current).toEqual({ state: "not-set" });
			expect(read.legacy).toBe(false);
			expect(read.ambiguous).toBe(false);
			expect(read.edit).toEqual({ kind: "none", reason: "no-frontmatter" });
		},
	);

	it("treats an unclosed block as no frontmatter", () => {
		const read = readOk("---\nstatus: approved\nbody\n", "plan");
		expect(read.current).toEqual({ state: "not-set" });
		expect(read.edit).toEqual({ kind: "none", reason: "no-frontmatter" });
	});

	it("never reads a status that appears only in the body", () => {
		const content = "---\nintent: x\n---\nstatus: approved\n";
		const read = readOk(content, "plan");
		expect(read.current).toEqual({ state: "not-set" });
		expect(read.edit.kind).toBe("insert");
	});

	it("reports the parser message when the YAML does not parse", () => {
		const read = readGovernedValue({ content: "---\nstatus: [unclosed\n---\n", kind: "plan" });
		expect(read.status).toBe("unparsable");
		if (read.status !== "unparsable") return;
		expect(read.detail.length).toBeGreaterThan(0);
	});

	it("reports a duplicate key as unparsable", () => {
		const read = readGovernedValue({
			content: "---\nstatus: approved\nstatus: completed\n---\n",
			kind: "plan",
		});
		expect(read.status).toBe("unparsable");
	});

	it("reports frontmatter that is not a mapping as unparsable", () => {
		const read = readGovernedValue({ content: "---\n- a\n- b\n---\n", kind: "plan" });
		expect(read.status).toBe("unparsable");
	});
});

describe("readGovernedValue — line endings and BOM", () => {
	it("reads the same values from a CRLF file and addresses the line without its \\r", () => {
		const content = "---\r\nintent: x\r\nstatus: approved\r\n---\r\nbody\r\n";
		const read = readOk(content, "plan");
		expect(read.current).toEqual({ state: "set", value: "approved" });
		if (read.edit.kind !== "replace") throw new Error("expected replace");
		expect(content.slice(read.edit.start, read.edit.end)).toBe("status: approved");
	});

	it("reports eol \\r\\n on the insert site of a CRLF file", () => {
		const content = "---\r\nintent: x\r\n---\r\nbody\r\n";
		const read = readOk(content, "plan");
		expect(read.current).toEqual({ state: "not-set" });
		if (read.edit.kind !== "insert") throw new Error("expected insert");
		expect(read.edit.eol).toBe("\r\n");
		expect(content.slice(0, read.edit.at)).toBe("---\r\n");
	});

	it("places an insert after the scope line of a CRLF intent spec including its terminator", () => {
		const content = "---\r\nscope: src/x\r\ndescription: d\r\n---\r\n";
		const read = readOk(content, "intent-spec");
		if (read.edit.kind !== "insert") throw new Error("expected insert");
		expect(content.slice(0, read.edit.at)).toBe("---\r\nscope: src/x\r\n");
		expect(read.edit.eol).toBe("\r\n");
	});

	it("keeps offsets correct when the file starts with a BOM", () => {
		const content = "﻿---\r\nintent: x\r\nstatus: approved\r\n---\r\nbody\r\n";
		const read = readOk(content, "plan");
		expect(read.current).toEqual({ state: "set", value: "approved" });
		if (read.edit.kind !== "replace") throw new Error("expected replace");
		expect(content.slice(read.edit.start, read.edit.end)).toBe("status: approved");
	});

	it("keeps insert offsets correct when the file starts with a BOM", () => {
		const content = "﻿---\nintent: x\n---\n";
		const read = readOk(content, "plan");
		if (read.edit.kind !== "insert") throw new Error("expected insert");
		expect(content.slice(0, read.edit.at)).toBe("﻿---\n");
	});

	it("tolerates leading whitespace before the opening ---", () => {
		const content = "\n  ---\nstatus: approved\n---\n";
		const read = readOk(content, "plan");
		expect(read.current).toEqual({ state: "set", value: "approved" });
		if (read.edit.kind !== "replace") throw new Error("expected replace");
		expect(content.slice(read.edit.start, read.edit.end)).toBe("status: approved");
	});
});
