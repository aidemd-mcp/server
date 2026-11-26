import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import parseKanbanField from "./index.js";

const absolutePath = resolve(tmpdir(), "brain", "kanban");

describe("parseKanbanField", () => {
	it.each([
		["null", null],
		["a string", "folder"],
		["a number", 7],
		["an array", [{ source: "folder", path: absolutePath }]],
	])("reports a malformed mapping for %s", (_label, value) => {
		expect(parseKanbanField({ value })).toEqual({
			state: "malformed",
			field: "kanban",
			fault: "must be a mapping with `source` and `path`",
		});
	});

	it.each([
		["missing", {}],
		["a number", { source: 42 }],
	])("reports a required source when it is %s", (_label, value) => {
		expect(parseKanbanField({ value })).toEqual({
			state: "malformed",
			field: "kanban.source",
			fault: "is required and must be `folder`",
		});
	});

	it("reports an unsupported source verbatim", () => {
		expect(parseKanbanField({ value: { source: "command", path: absolutePath } })).toEqual({
			state: "malformed",
			field: "kanban.source",
			fault: "`command` is not a supported source; the only supported source is `folder`",
		});
	});

	it("reports an absent path key", () => {
		expect(parseKanbanField({ value: { source: "folder" } })).toEqual({
			state: "malformed",
			field: "kanban.path",
			fault: "is required: the absolute path of the brain's kanban folder, left empty while unwired",
		});
	});

	it("treats a null path as declared and unwired", () => {
		expect(parseKanbanField({ value: { source: "folder", path: null } })).toEqual({
			state: "declared",
			source: "folder",
			path: null,
		});
	});

	it("reports a non-string path", () => {
		expect(parseKanbanField({ value: { source: "folder", path: 42 } })).toEqual({
			state: "malformed",
			field: "kanban.path",
			fault: "must be an absolute path or left empty",
		});
	});

	it.each([
		["the empty string", ""],
		["a relative path", "relative/kanban"],
	])("reports %s as not absolute", (_label, path) => {
		expect(parseKanbanField({ value: { source: "folder", path } })).toEqual({
			state: "malformed",
			field: "kanban.path",
			fault: `must be an absolute path, got ${JSON.stringify(path)}`,
		});
	});

	it("declares an absolute path verbatim", () => {
		expect(parseKanbanField({ value: { source: "folder", path: absolutePath } })).toEqual({
			state: "declared",
			source: "folder",
			path: absolutePath,
		});
	});

	it("keeps a trailing separator untouched", () => {
		const withSeparator = `${absolutePath}/`;
		expect(parseKanbanField({ value: { source: "folder", path: withSeparator } })).toEqual({
			state: "declared",
			source: "folder",
			path: withSeparator,
		});
	});

	it("ignores unknown keys inside the mapping", () => {
		expect(parseKanbanField({ value: { source: "folder", path: absolutePath, extra: 1 } })).toEqual({
			state: "declared",
			source: "folder",
			path: absolutePath,
		});
	});
});
