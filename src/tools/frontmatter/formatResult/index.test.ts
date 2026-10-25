import { describe, expect, it } from "vitest";
import formatResult from "./index.js";
import type { FrontmatterOutcome, FrontmatterRefusal } from "../types/index.js";

const PATH = "src/x/plan.aide";

describe("formatResult — non-refused outcomes", () => {
	it.each([
		[
			"read, set",
			{ kind: "read", path: PATH, field: "status", current: { state: "set", value: "approved" }, legacy: false },
			`${PATH} — status: approved`,
		],
		[
			"read, not set",
			{ kind: "read", path: PATH, field: "status", current: { state: "not-set" }, legacy: false },
			`${PATH} — status: not set`,
		],
		[
			"read, invalid",
			{ kind: "read", path: PATH, field: "status", current: { state: "invalid", raw: "in-flight" }, legacy: false },
			`${PATH} — status: not valid ("in-flight")`,
		],
		[
			"read, legacy",
			{ kind: "read", path: PATH, field: "alignment", current: { state: "set", value: "aligned" }, legacy: true },
			`${PATH} — alignment: aligned (recorded under the older name status)`,
		],
		[
			"changed",
			{ kind: "changed", path: PATH, field: "status", from: { state: "set", value: "proposed" }, to: "approved", movedFromLegacy: false },
			`${PATH} — status: proposed → approved`,
		],
		[
			"changed from not set",
			{ kind: "changed", path: PATH, field: "status", from: { state: "not-set" }, to: "proposed", movedFromLegacy: false },
			`${PATH} — status: not set → proposed`,
		],
		[
			"changed from invalid",
			{ kind: "changed", path: PATH, field: "status", from: { state: "invalid", raw: "in-flight" }, to: "approved", movedFromLegacy: false },
			`${PATH} — status: "in-flight" → approved`,
		],
		[
			"changed, moved from legacy",
			{ kind: "changed", path: PATH, field: "alignment", from: { state: "set", value: "aligned" }, to: "aligned", movedFromLegacy: true },
			`${PATH} — alignment: aligned → aligned (moved from the older name status)`,
		],
		[
			"unchanged",
			{ kind: "unchanged", path: PATH, field: "status", value: "approved" },
			`${PATH} — status: approved (no change)`,
		],
	] as [string, FrontmatterOutcome, string][])("%s", (_name, outcome, text) => {
		expect(formatResult(outcome)).toEqual({ text, isError: false });
	});
});

describe("formatResult — refusals", () => {
	it.each([
		[{ kind: "pairing" }, "field and value go together; pass both to change a value, or neither to read"],
		[{ kind: "outside-root" }, "the path resolves outside the project root"],
		[{ kind: "missing" }, "no such file"],
		[{ kind: "not-a-file" }, "not a regular file"],
		[{ kind: "not-aide" }, "not an AIDE file; only .aide files carry governed values"],
		[{ kind: "ungoverned", which: "session" }, "the session record carries no governed values"],
		[{ kind: "ungoverned", which: "research" }, "a research spec carries no governed values"],
		[{ kind: "ungoverned", which: "config" }, "brain.aide is configuration and carries no governed values"],
		[{ kind: "unparsable", detail: "bad yaml" }, "its frontmatter cannot be parsed (bad yaml)"],
		[{ kind: "no-frontmatter", field: "status" }, "it has no frontmatter block to hold status"],
		[{ kind: "multi-line", field: "alignment" }, "its alignment value spans more than one line, so it cannot be changed safely"],
		[
			{ kind: "unknown-field", field: "description" },
			"description is not a governed field; the governed fields are alignment (intent specs) and status (plans, todo lists and briefs)",
		],
		[{ kind: "wrong-field", fileKind: "intent-spec", field: "status", expected: "alignment" }, "an intent spec carries alignment, not status"],
		[{ kind: "wrong-field", fileKind: "plan", field: "alignment", expected: "status" }, "a plan carries status, not alignment"],
		[{ kind: "wrong-field", fileKind: "todo", field: "alignment", expected: "status" }, "a todo list carries status, not alignment"],
		[{ kind: "wrong-field", fileKind: "brief", field: "alignment", expected: "status" }, "a brief carries status, not alignment"],
		[
			{ kind: "ambiguous-alignment" },
			"it records alignment under both alignment and the older name status, so its alignment is ambiguous",
		],
		[
			{ kind: "invalid-value", fileKind: "plan", field: "status", value: "in-flight", allowed: ["proposed", "approved", "completed", "abandoned"] },
			"in-flight is not a status value for a plan; allowed values: proposed, approved, completed, abandoned",
		],
		[
			{ kind: "transition", field: "status", from: { state: "set", value: "proposed" }, to: "completed", allowed: ["approved", "abandoned"] },
			"status cannot move from proposed to completed; allowed next values: approved, abandoned",
		],
		[
			{ kind: "transition", field: "status", from: { state: "invalid", raw: "in-flight" }, to: "completed", allowed: ["proposed", "approved", "abandoned"] },
			'status cannot move from "in-flight" to completed; allowed next values: proposed, approved, abandoned',
		],
		[
			{ kind: "transition", field: "status", from: { state: "not-set" }, to: "completed", allowed: ["proposed", "approved", "abandoned"] },
			"status cannot move from not set to completed; allowed next values: proposed, approved, abandoned",
		],
		[{ kind: "final", field: "status", value: "completed" }, "status is completed, which is final; it cannot change"],
		[{ kind: "plan-not-completed", plan: "approved" }, "a brief is completed only after its plan; plan.aide beside it is approved"],
	] as [FrontmatterRefusal, string][])("%j", (refusal, reason) => {
		expect(formatResult({ kind: "refused", path: PATH, refusal })).toEqual({
			text: `Refused: ${PATH} — ${reason}`,
			isError: true,
		});
	});

	it("lists one open item with the singular header", () => {
		expect(
			formatResult({ kind: "refused", path: PATH, refusal: { kind: "open-items", items: [{ line: 7, text: "do it" }] } }),
		).toEqual({
			text: `Refused: ${PATH} — completed is refused while 1 item is unchecked:\n${PATH}:7: do it`,
			isError: true,
		});
	});

	it("lists several open items with the plural header", () => {
		expect(
			formatResult({
				kind: "refused",
				path: PATH,
				refusal: {
					kind: "open-items",
					items: [
						{ line: 7, text: "do it" },
						{ line: 9, text: "and this" },
					],
				},
			}),
		).toEqual({
			text: `Refused: ${PATH} — completed is refused while 2 items are unchecked:\n${PATH}:7: do it\n${PATH}:9: and this`,
			isError: true,
		});
	});
});
