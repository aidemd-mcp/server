import { describe, it, expect } from "vitest";
import { GOVERNED_FIELDS, LEGACY_ALIGNMENT_KEY } from "./index.js";
import type { GovernedKind } from "../types/index.js";

const KINDS = Object.keys(GOVERNED_FIELDS) as GovernedKind[];

describe("GOVERNED_FIELDS", () => {
	it.each(KINDS)("%s: initial is a member of its own values", (kind) => {
		const { values, initial } = GOVERNED_FIELDS[kind];
		expect(values as readonly string[]).toContain(initial);
	});

	it.each([
		["intent-spec", "alignment"],
		["plan", "status"],
		["todo", "status"],
		["brief", "status"],
	] as const)("%s carries the %s field", (kind, field) => {
		expect(GOVERNED_FIELDS[kind].field).toBe(field);
	});

	it.each(["todo", "brief"] as const)(
		"%s shares plan's values and starting value proposed",
		(kind) => {
			expect(GOVERNED_FIELDS[kind].values).toEqual(
				GOVERNED_FIELDS.plan.values,
			);
			expect(GOVERNED_FIELDS[kind].initial).toBe("proposed");
		},
	);

	it("plan starts at proposed and intent-spec at unreviewed", () => {
		expect(GOVERNED_FIELDS.plan.initial).toBe("proposed");
		expect(GOVERNED_FIELDS["intent-spec"].initial).toBe("unreviewed");
	});

	it("covers exactly the four governed kinds", () => {
		expect([...KINDS].sort()).toEqual(["brief", "intent-spec", "plan", "todo"]);
	});
});

describe("LEGACY_ALIGNMENT_KEY", () => {
	it("is the older name status", () => {
		expect(LEGACY_ALIGNMENT_KEY).toBe("status");
	});
});
