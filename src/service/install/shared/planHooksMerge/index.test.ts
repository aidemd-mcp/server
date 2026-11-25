import { describe, it, expect } from "vitest";
import { parse } from "jsonc-parser";
import planHooksMerge from "./index.js";
import aideHookEntries, { AIDE_HOOK_COMMAND } from "./aideHookEntries/index.js";

const EVENTS = aideHookEntries.map((entry) => entry.event);

/** A fully wired hooks object, optionally leaving some events out. */
const wiredHooks = (without: string[] = []) =>
	Object.fromEntries(
		aideHookEntries.filter(({ event }) => !without.includes(event)).map(({ event, group }) => [event, [group]]),
	);

const count = (text: string, needle: string) => text.split(needle).length - 1;

/**
 * For a merge that inserts into one place, the input must be exactly the common
 * prefix and suffix of the merged text: no original byte moved or changed.
 */
const onlyInsertedBytesDiffer = (input: string, merged: string) => {
	let prefix = 0;
	while (prefix < input.length && input[prefix] === merged[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < input.length - prefix &&
		input[input.length - 1 - suffix] === merged[merged.length - 1 - suffix]
	) {
		suffix++;
	}
	return prefix + suffix === input.length && merged.length > input.length;
};

const plan = (text: string | null) => planHooksMerge({ text });

const planMissing = (text: string) => {
	const result = plan(text);
	if (result.state !== "missing") throw new Error(`expected missing, got ${result.state}`);
	return result;
};

describe("planHooksMerge: no file or an empty file", () => {
	it("absent: a new file holding only the hooks object, two-space, trailing newline", () => {
		const result = plan(null);
		if (result.state !== "absent") throw new Error(`expected absent, got ${result.state}`);
		expect(result.merged).toBe(`${JSON.stringify({ hooks: wiredHooks() }, null, 2)}\n`);
		expect(result.merged).not.toContain("\t");
		expect(Object.keys(JSON.parse(result.merged))).toEqual(["hooks"]);
		expect(Object.keys(JSON.parse(result.merged).hooks)).toEqual(EVENTS);
	});

	it.each(["", "  \n", "\r\n"])("an empty or blank file (%j) is planned like an absent one", (text) => {
		expect(plan(text)).toEqual(plan(null));
	});

	it("planning the absent file's merged text again is complete", () => {
		const result = plan(null);
		if (result.state !== "absent") throw new Error("expected absent");
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});
});

describe("planHooksMerge: complete", () => {
	it("every event wired: no change", () => {
		expect(plan(JSON.stringify({ hooks: wiredHooks() }, null, 2))).toEqual({ state: "complete" });
	});

	it("recognises AIDE's entries behind a user's own hooks, a moved group and other keys", () => {
		const settings = {
			model: "opus",
			hooks: Object.fromEntries(
				aideHookEntries.map(({ event, group }) => [
					event,
					[{ hooks: [{ type: "command", command: "echo mine" }] }, { matcher: "Bash", ...group }],
				]),
			),
		};
		expect(plan(JSON.stringify(settings, null, "\t"))).toEqual({ state: "complete" });
	});

	it("is complete for a commented file with every entry present", () => {
		const hooks = JSON.stringify(wiredHooks(), null, 2).replace(/\n/g, "\n  ");
		expect(plan(`{\n  // mine\n  "hooks": ${hooks}\n}\n`)).toEqual({ state: "complete" });
	});
});

describe("planHooksMerge: missing", () => {
	it("no hooks key: adds every event after the user's keys, every original byte kept", () => {
		const input = '{\n  "model": "opus"\n}\n';
		const result = planMissing(input);
		expect(result.events).toEqual(EVENTS);
		expect(result.merged.startsWith('{\n  "model": "opus",\n  "hooks": {')).toBe(true);
		expect(result.merged.endsWith("}\n")).toBe(true);
		expect(parse(result.merged).model).toBe("opus");
		expect(Object.keys(parse(result.merged).hooks)).toEqual(EVENTS);
	});

	it("an empty settings object gets the hooks and stays valid", () => {
		const result = planMissing("{}");
		expect(Object.keys(parse(result.merged).hooks)).toEqual(EVENTS);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("hooks without some events: adds only the unwired ones, in order", () => {
		const input = JSON.stringify({ hooks: wiredHooks(["PostToolUse", "SessionEnd"]) }, null, 2);
		const result = planMissing(input);
		expect(result.events).toEqual(["PostToolUse", "SessionEnd"]);
		expect(count(result.merged, AIDE_HOOK_COMMAND)).toBe(EVENTS.length);
	});

	it("an event array holding a user's hook keeps it first and appends AIDE's", () => {
		const user = { hooks: [{ type: "command", command: "echo mine" }] };
		const input = JSON.stringify({ hooks: { ...wiredHooks(["Stop"]), Stop: [user] } }, null, 2);
		const result = planMissing(input);
		expect(result.events).toEqual(["Stop"]);
		expect(parse(result.merged).hooks.Stop).toEqual([user, aideHookEntries.find((entry) => entry.event === "Stop")?.group]);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
	});

	it("partial presence: every other byte unchanged (one gap in a pretty-printed file)", () => {
		const input = `${JSON.stringify({ env: { A: "1" }, hooks: wiredHooks(["UserPromptSubmit"]) }, null, 2)}\n`;
		const result = planMissing(input);
		expect(result.events).toEqual(["UserPromptSubmit"]);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
	});

	it("tabs and CRLF: the insertion follows the file and no original byte changes", () => {
		const input =
			JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: wiredHooks(["Stop"]) }, null, "\t").replace(/\n/g, "\r\n") +
			"\r\n";
		const result = planMissing(input);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
		expect(result.merged).not.toMatch(/[^\r]\n/);
		expect(result.merged).not.toMatch(/^ +\S/m);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("four-space indentation is followed", () => {
		const input = `${JSON.stringify({ hooks: wiredHooks(["Stop"]) }, null, 4)}\n`;
		const result = planMissing(input);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
		expect(result.merged).not.toMatch(/^( {2}|\t)\S/m);
	});

	it("comments survive byte for byte", () => {
		const input = [
			"{",
			"  // my model",
			'  "model": "opus", /* keep */',
			'  "hooks": {',
			'    "SessionStart": [{ "hooks": [{ "type": "command", "command": "aidemd-mcp hook" }] }],',
			"    // my stop hook",
			'    "Stop": [{ "hooks": [{ "type": "command", "command": "echo mine" }] }]',
			"  }",
			"}",
			"",
		].join("\n");
		const result = planMissing(input);
		expect(result.events).toEqual(["UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"]);
		for (const kept of ["// my model", "/* keep */", "// my stop hook", '"command": "echo mine"']) {
			expect(result.merged).toContain(kept);
		}
		const stopLine = '    "Stop": [{ "hooks": [{ "type": "command", "command": "echo mine" }] }';
		expect(result.merged).toContain(stopLine);
		expect(result.merged.startsWith(input.slice(0, input.indexOf('    "SessionStart"')))).toBe(true);
		expect(result.merged.endsWith("  }\n}\n")).toBe(true);
	});

	it("a compact single-line file keeps its own bytes", () => {
		const input = '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"echo mine"}]}]}}';
		const result = planMissing(input);
		expect(result.merged).toContain('"Stop":[{"hooks":[{"type":"command","command":"echo mine"}]}');
		expect(parse(result.merged).hooks.Stop[0].hooks[0].command).toBe("echo mine");
	});

	it("a trailing comma in the file is tolerated", () => {
		expect(plan('{\n  "hooks": {\n    "Stop": [],\n  },\n}\n').state).toBe("missing");
	});

	it("applying the merged text and planning again is complete, and AIDE's command is never added twice", () => {
		const inputs = [
			"{}",
			'{ "model": "x" }',
			JSON.stringify({ hooks: wiredHooks(["Stop", "SessionStart"]) }, null, 2),
			JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }, null, "\t"),
		];
		for (const input of inputs) {
			const first = planMissing(input);
			expect(plan(first.merged)).toEqual({ state: "complete" });
			expect(count(first.merged, AIDE_HOOK_COMMAND)).toBe(EVENTS.length);
		}
	});
});

describe("planHooksMerge: malformed", () => {
	it.each([
		["a syntax error", '{ "hooks": '],
		["an unquoted key", "{ hooks: {} }"],
		["a non-object root", "[]"],
		["a scalar root", '"text"'],
		["a non-object hooks key", '{ "hooks": [] }'],
		["a non-array event", '{ "hooks": { "Stop": {} } }'],
	])("%s", (_label, text) => {
		const result = plan(text);
		expect(result.state).toBe("malformed");
		if (result.state === "malformed") expect(result.reason.length).toBeGreaterThan(0);
	});
});
