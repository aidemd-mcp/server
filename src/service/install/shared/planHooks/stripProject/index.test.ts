import { describe, it, expect } from "vitest";
import { parse } from "jsonc-parser";
import stripProject from "./index.js";

const AIDE_EVENTS = ["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"];
const FORMATTER = { matcher: "Write", hooks: [{ type: "command", command: "prettier --write ." }] };
const PERMISSIONS = { allow: ["Bash(npm test)"] };

/** Today's shared-file shape: five AIDE entries beside a formatter hook and a permissions block. */
const shared = JSON.stringify(
	{
		permissions: PERMISSIONS,
		hooks: {
			...Object.fromEntries(AIDE_EVENTS.map((event) => [event, [{ hooks: [{ type: "command", command: "aidemd-mcp hook" }] }]])),
			PreToolUse: [FORMATTER],
		},
	},
	null,
	2,
);

describe("stripProject", () => {
	it("is absent for a missing or blank file", () => {
		expect(stripProject({ text: null })).toEqual({ state: "absent" });
		expect(stripProject({ text: "  \n" })).toEqual({ state: "absent" });
	});

	it("is malformed for a file that does not parse", () => {
		const plan = stripProject({ text: "{ \"hooks\": " });
		expect(plan.state).toBe("malformed");
	});

	it("is malformed when hooks is not an object", () => {
		expect(stripProject({ text: "{ \"hooks\": [] }" })).toEqual({
			state: "malformed",
			reason: "\"hooks\" is not an object",
		});
	});

	it("is clean for a file holding only user hooks", () => {
		const text = JSON.stringify({ hooks: { PreToolUse: [FORMATTER] }, permissions: PERMISSIONS }, null, 2);
		expect(stripProject({ text })).toEqual({ state: "clean" });
	});

	it("is clean for a file without hooks", () => {
		expect(stripProject({ text: JSON.stringify({ permissions: PERMISSIONS }) })).toEqual({ state: "clean" });
	});

	it("holds when AIDE's entries sit beside a formatter hook and permissions", () => {
		const plan = stripProject({ text: shared });
		if (plan.state !== "holds") throw new Error(`expected holds, got ${plan.state}`);
		expect(plan.events).toEqual(AIDE_EVENTS);
		expect(parse(plan.stripped)).toEqual({ permissions: PERMISSIONS, hooks: { PreToolUse: [FORMATTER] } });
	});

	it("names only the events AIDE's hooks were found under", () => {
		const text = JSON.stringify(
			{ hooks: { Stop: [{ hooks: [{ type: "command", command: "aidemd-mcp hook" }] }], PreToolUse: [FORMATTER] } },
			null,
			2,
		);
		const plan = stripProject({ text });
		if (plan.state !== "holds") throw new Error(`expected holds, got ${plan.state}`);
		expect(plan.events).toEqual(["Stop"]);
	});

	it("keeps the user's bytes outside the removed ranges", () => {
		const plan = stripProject({ text: shared });
		if (plan.state !== "holds") throw new Error(`expected holds, got ${plan.state}`);
		expect(plan.stripped).toContain(JSON.stringify(PERMISSIONS, null, 2).split("\n").join("\n  "));
		expect(plan.stripped).toContain("prettier --write .");
	});

	it("is clean when the stripped text is planned again", () => {
		const plan = stripProject({ text: shared });
		if (plan.state !== "holds") throw new Error(`expected holds, got ${plan.state}`);
		expect(stripProject({ text: plan.stripped })).toEqual({ state: "clean" });
	});
});
