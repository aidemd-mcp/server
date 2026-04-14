import { describe, it, expect } from "vitest";
import parseTodoItems from "./index.js";

describe("parseTodoItems", () => {
	it("returns an empty array for an empty body", () => {
		expect(parseTodoItems("")).toEqual([]);
	});

	it("returns an empty array when there are no checklist items", () => {
		const body = "## Retro\n\nSome retro notes with no checklist.\n";
		expect(parseTodoItems(body)).toEqual([]);
	});

	it("parses a single unchecked item", () => {
		const body = "- [ ] Fix the thing\n";
		expect(parseTodoItems(body)).toEqual([{ text: "Fix the thing", done: false }]);
	});

	it("parses a single checked item", () => {
		const body = "- [x] Already fixed\n";
		expect(parseTodoItems(body)).toEqual([{ text: "Already fixed", done: true }]);
	});

	it("parses multiple items with mixed states", () => {
		const body = [
			"- [x] First done",
			"- [ ] Second open",
			"- [x] Third done",
			"- [ ] Fourth open",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual({ text: "First done", done: true });
		expect(result[1]).toEqual({ text: "Second open", done: false });
		expect(result[2]).toEqual({ text: "Third done", done: true });
		expect(result[3]).toEqual({ text: "Fourth open", done: false });
	});

	it("extracts Misalignment annotation from a continuation line", () => {
		const body = [
			"- [ ] Something is broken",
			"  Traces to: desired outcome 3",
			"  Misalignment: implementation-drift",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			text: "Something is broken",
			done: false,
			misalignment: "implementation-drift",
		});
	});

	it("extracts Misalignment from a tab-indented continuation line", () => {
		const body = ["- [ ] A broken item", "\tMisalignment: test-gap"].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]!.misalignment).toBe("test-gap");
	});

	it("does not attach Misalignment from one item to the next", () => {
		const body = [
			"- [ ] First item",
			"  Misalignment: implementation-drift",
			"- [ ] Second item",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(2);
		expect(result[0]!.misalignment).toBe("implementation-drift");
		expect(result[1]!.misalignment).toBeUndefined();
	});

	it("uses only the first Misalignment annotation when multiple are present", () => {
		const body = [
			"- [ ] Multi-annotated item",
			"  Misalignment: implementation-drift",
			"  Misalignment: test-gap",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]!.misalignment).toBe("implementation-drift");
	});

	it("leaves misalignment undefined when no Misalignment annotation exists", () => {
		const body = [
			"- [ ] Item with traces but no misalignment",
			"  Traces to: desired outcome 1",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]!.misalignment).toBeUndefined();
	});

	it("parses items correctly when interspersed with headings", () => {
		const body = [
			"## Issues — Round 1",
			"",
			"- [x] Fixed issue one",
			"  Misalignment: implementation-drift",
			"",
			"## Issues — Round 2",
			"",
			"- [ ] Open issue two",
			"  Misalignment: test-gap",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ text: "Fixed issue one", done: true, misalignment: "implementation-drift" });
		expect(result[1]).toEqual({ text: "Open issue two", done: false, misalignment: "test-gap" });
	});

	it("parses the format used in actual todo.aide files (bold path prefix)", () => {
		const body = [
			"- [x] **`src/cli/App/index.tsx:141-185`** — Drill-in mode keyboard handler handles only Escape/Backspace.",
			"  Traces to: desired outcome — Body sections rendered as collapsible",
			"  Misalignment: implementation-drift",
		].join("\n");

		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]!.done).toBe(true);
		expect(result[0]!.text).toContain("Drill-in mode keyboard handler");
		expect(result[0]!.misalignment).toBe("implementation-drift");
	});

	it("handles all items checked (all done)", () => {
		const body = ["- [x] Step one", "- [x] Step two", "- [x] Step three"].join("\n");
		const result = parseTodoItems(body);
		expect(result.every((item) => item.done)).toBe(true);
	});

	it("handles all items unchecked (all open)", () => {
		const body = ["- [ ] Step one", "- [ ] Step two"].join("\n");
		const result = parseTodoItems(body);
		expect(result.every((item) => !item.done)).toBe(true);
	});

	it("flushes the last item when the body ends with a continuation line", () => {
		const body = ["- [ ] Last item", "  Misalignment: plan-gap"].join("\n");
		const result = parseTodoItems(body);
		expect(result).toHaveLength(1);
		expect(result[0]!.misalignment).toBe("plan-gap");
	});

	it("trims whitespace from item text", () => {
		const body = "- [ ]   Whitespace padded item   \n";
		const result = parseTodoItems(body);
		expect(result[0]!.text).toBe("Whitespace padded item");
	});
});
