import { describe, expect, it } from "vitest";
import checkTransition from "./index.js";
import { GOVERNED_FIELDS } from "../governedFields/index.js";
import type { CurrentValue, GovernedKind } from "../types/index.js";

const WORK_KINDS: GovernedKind[] = ["plan", "todo", "brief"];

/** Expected moves out of each work status, written out independently of the implementation. */
const WORK_EXPECTED: Record<string, string[]> = {
	proposed: ["approved", "abandoned"],
	approved: ["proposed", "completed", "abandoned"].sort(
		(a, b) => GOVERNED_FIELDS.plan.values.indexOf(a as never) - GOVERNED_FIELDS.plan.values.indexOf(b as never),
	),
	completed: [],
	abandoned: [],
};

const set = (value: string): CurrentValue => ({ state: "set", value });

describe.each(WORK_KINDS)("checkTransition — %s lifecycle", (kind) => {
	const pairs = GOVERNED_FIELDS[kind].values.flatMap((from) =>
		GOVERNED_FIELDS[kind].values.map((to) => [from, to] as const),
	);

	it.each(pairs)("%s -> %s", (from, to) => {
		const allowed = WORK_EXPECTED[from]!;
		const result = checkTransition({ kind, current: set(from), to });
		if (allowed.includes(to)) {
			expect(result).toEqual({ ok: true });
			return;
		}
		expect(result).toEqual({ ok: false, final: allowed.length === 0, allowed });
	});

	it.each([
		["not-set", { state: "not-set" } as CurrentValue],
		["invalid", { state: "invalid", raw: "in-flight" } as CurrentValue],
	])("from %s allows proposed, approved, abandoned and is never final", (_name, current) => {
		for (const to of ["proposed", "approved", "abandoned"]) {
			expect(checkTransition({ kind, current, to })).toEqual({ ok: true });
		}
		expect(checkTransition({ kind, current, to: "completed" })).toEqual({
			ok: false,
			final: false,
			allowed: ["proposed", "approved", "abandoned"],
		});
	});
});

describe("checkTransition — intent spec alignment", () => {
	const values = GOVERNED_FIELDS["intent-spec"].values;
	const moves = values.flatMap((from) => values.filter((to) => to !== from).map((to) => [from, to] as const));

	it("has six moves", () => {
		expect(moves).toHaveLength(6);
	});

	it.each(moves)("%s -> %s is allowed", (from, to) => {
		expect(checkTransition({ kind: "intent-spec", current: set(from), to })).toEqual({ ok: true });
	});

	it.each([
		["aligned", "unreviewed"],
		["misaligned", "unreviewed"],
	])("allows %s -> %s", (from, to) => {
		expect(checkTransition({ kind: "intent-spec", current: set(from), to })).toEqual({ ok: true });
	});

	it.each([
		["not-set", { state: "not-set" } as CurrentValue],
		["invalid", { state: "invalid", raw: "nope" } as CurrentValue],
	])("from %s allows every alignment value", (_name, current) => {
		for (const to of values) {
			expect(checkTransition({ kind: "intent-spec", current, to })).toEqual({ ok: true });
		}
	});
});
