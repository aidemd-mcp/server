import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import hasOpenWork from "./index.js";

const base: ModuleRow = {
	folder: "a",
	label: "a",
	description: null,
	alignment: null,
	intentFile: null,
	brief: null,
	plan: null,
	todo: null,
	research: null,
	malformed: [],
};

describe("hasOpenWork", () => {
	it("is true for a proposed or approved plan and false for a completed one", () => {
		expect(hasOpenWork({ module: { ...base, plan: { file: "p", status: "proposed", done: 0, total: 1 } } })).toBe(true);
		expect(hasOpenWork({ module: { ...base, plan: { file: "p", status: "approved", done: 0, total: 1 } } })).toBe(true);
		expect(hasOpenWork({ module: { ...base, plan: { file: "p", status: "completed", done: 1, total: 1 } } })).toBe(false);
	});

	it("is true for a todo with open items and false when all are resolved", () => {
		expect(hasOpenWork({ module: { ...base, todo: { file: "t", open: 1, total: 3 } } })).toBe(true);
		expect(hasOpenWork({ module: { ...base, todo: { file: "t", open: 0, total: 3 } } })).toBe(false);
	});
});
