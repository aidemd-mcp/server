import { describe, it, expect } from "vitest";
import { parse } from "jsonc-parser";
import mergeLocal from "./index.js";
import aideHookEntries from "./aideHookEntries/index.js";
import buildCommand from "./buildCommand/index.js";

const ENTRY = "C:/Users/me/npm/node_modules/@aidemd-mcp/server/dist/index.js";
const COMMAND = buildCommand(ENTRY);
const ENTRIES = aideHookEntries(COMMAND);
const EVENTS = ENTRIES.map((entry) => entry.event);

/** A fully wired hooks object, optionally leaving some events out. */
const wiredHooks = (without: string[] = []) =>
	Object.fromEntries(ENTRIES.filter(({ event }) => !without.includes(event)).map(({ event, group }) => [event, [group]]));

const ESCAPED_COMMAND = JSON.stringify(COMMAND).slice(1, -1);
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

const plan = (text: string | null) => mergeLocal({ text, entry: ENTRY });

const planOutdated = (text: string) => {
	const result = plan(text);
	if (result.state !== "outdated") throw new Error(`expected outdated, got ${result.state}`);
	return result;
};

describe("mergeLocal: no file or an empty file", () => {
	it("absent: a new file holding only the hooks object, two-space, trailing newline", () => {
		const result = plan(null);
		if (result.state !== "absent") throw new Error(`expected absent, got ${result.state}`);
		expect(result.merged).toBe(`${JSON.stringify({ hooks: wiredHooks() }, null, 2)}\n`);
		expect(result.merged).not.toContain("\t");
		expect(Object.keys(JSON.parse(result.merged))).toEqual(["hooks"]);
		expect(Object.keys(JSON.parse(result.merged).hooks)).toEqual(EVENTS);
	});

	it("writes the node form and the SessionEnd timeout", () => {
		const result = plan(null);
		if (result.state !== "absent") throw new Error("expected absent");
		const hooks = JSON.parse(result.merged).hooks;
		expect(hooks.SessionEnd[0].hooks[0]).toEqual({ type: "command", command: COMMAND, timeout: 10 });
		expect(hooks.Stop[0].hooks[0]).toEqual({ type: "command", command: COMMAND });
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

describe("mergeLocal: complete", () => {
	it("every event wired: no change", () => {
		expect(plan(JSON.stringify({ hooks: wiredHooks() }, null, 2))).toEqual({ state: "complete" });
	});

	it("recognises AIDE's entries behind a user's own hooks, a moved group and other keys", () => {
		const settings = {
			model: "opus",
			hooks: Object.fromEntries(
				ENTRIES.map(({ event, group }) => [
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

describe("mergeLocal: outdated", () => {
	it("no hooks key: adds every event after the user's keys, every original byte kept", () => {
		const input = '{\n  "model": "opus"\n}\n';
		const result = planOutdated(input);
		expect(result.events).toEqual(EVENTS);
		expect(result.merged.startsWith('{\n  "model": "opus",\n  "hooks": {')).toBe(true);
		expect(result.merged.endsWith("}\n")).toBe(true);
		expect(parse(result.merged).model).toBe("opus");
		expect(Object.keys(parse(result.merged).hooks)).toEqual(EVENTS);
	});

	it("an empty settings object gets the hooks and stays valid", () => {
		const result = planOutdated("{}");
		expect(Object.keys(parse(result.merged).hooks)).toEqual(EVENTS);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("hooks without some events: adds only the unwired ones, in order", () => {
		const input = JSON.stringify({ hooks: wiredHooks(["PostToolUse", "SessionEnd"]) }, null, 2);
		const result = planOutdated(input);
		expect(result.events).toEqual(["PostToolUse", "SessionEnd"]);
		expect(count(result.merged, ESCAPED_COMMAND)).toBe(EVENTS.length);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
	});

	it("an event array holding a user's hook keeps it first and appends AIDE's", () => {
		const user = { hooks: [{ type: "command", command: "echo mine" }] };
		const input = JSON.stringify({ hooks: { ...wiredHooks(["Stop"]), Stop: [user] } }, null, 2);
		const result = planOutdated(input);
		expect(result.events).toEqual(["Stop"]);
		expect(parse(result.merged).hooks.Stop).toEqual([user, ENTRIES.find((entry) => entry.event === "Stop")?.group]);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
	});

	it("rewrites today's `aidemd-mcp hook` entries to the node form with the SessionEnd timeout", () => {
		const old = { hooks: [{ type: "command", command: "aidemd-mcp hook" }] };
		const input = JSON.stringify(
			{ hooks: Object.fromEntries(EVENTS.map((event) => [event, [event === "PostToolUse" ? { matcher: "*", ...old } : old]])) },
			null,
			2,
		);
		const result = planOutdated(input);
		expect(result.events).toEqual(EVENTS);
		expect(result.merged).not.toContain("aidemd-mcp hook");
		const hooks = parse(result.merged).hooks;
		expect(hooks).toEqual(wiredHooks());
		expect(hooks.SessionEnd[0].hooks[0].timeout).toBe(10);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("rewrites a stale path and leaves the other events' bytes alone", () => {
		const stale = { hooks: [{ type: "command", command: 'node "D:/old/@aidemd-mcp/server/dist/index.js" hook' }] };
		const input = JSON.stringify({ hooks: { ...wiredHooks(["Stop"]), Stop: [stale] } }, null, 2);
		const result = planOutdated(input);
		expect(result.events).toEqual(["Stop"]);
		expect(result.merged).not.toContain("D:/old");
		expect(parse(result.merged).hooks).toEqual(wiredHooks());
	});

	it("a SessionEnd hook missing its timeout is rewritten", () => {
		const untimed = { hooks: [{ type: "command", command: COMMAND }] };
		const result = planOutdated(JSON.stringify({ hooks: { ...wiredHooks(["SessionEnd"]), SessionEnd: [untimed] } }, null, 2));
		expect(result.events).toEqual(["SessionEnd"]);
		expect(parse(result.merged).hooks.SessionEnd).toEqual([ENTRIES[4].group]);
	});

	it("a duplicate AIDE hook collapses to one canonical group", () => {
		const group = ENTRIES[3].group;
		const result = planOutdated(JSON.stringify({ hooks: { ...wiredHooks(["Stop"]), Stop: [group, group] } }, null, 2));
		expect(parse(result.merged).hooks.Stop).toEqual([group]);
	});

	it("a user hook in the same group as a stale AIDE hook survives, with other settings byte-identical", () => {
		const user = { type: "command", command: "echo mine" };
		const stale = { type: "command", command: "aidemd-mcp hook" };
		const input = `${JSON.stringify(
			{ permissions: { allow: ["Bash(ls)"] }, hooks: { ...wiredHooks(["Stop"]), Stop: [{ hooks: [user, stale] }] } },
			null,
			2,
		)}\n`;
		const result = planOutdated(input);
		const parsed = parse(result.merged);
		expect(parsed.hooks.Stop).toEqual([{ hooks: [user] }, ENTRIES[3].group]);
		expect(parsed.permissions).toEqual({ allow: ["Bash(ls)"] });
		expect(result.merged.startsWith(input.slice(0, input.indexOf('"Stop"')))).toBe(true);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("tabs and CRLF: the insertion follows the file and no original byte changes", () => {
		const input =
			JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: wiredHooks(["Stop"]) }, null, "\t").replace(/\n/g, "\r\n") +
			"\r\n";
		const result = planOutdated(input);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
		expect(result.merged).not.toMatch(/[^\r]\n/);
		expect(result.merged).not.toMatch(/^ +\S/m);
		expect(plan(result.merged)).toEqual({ state: "complete" });
	});

	it("four-space indentation is followed", () => {
		const input = `${JSON.stringify({ hooks: wiredHooks(["Stop"]) }, null, 4)}\n`;
		const result = planOutdated(input);
		expect(onlyInsertedBytesDiffer(input, result.merged)).toBe(true);
		expect(result.merged).not.toMatch(/^( {2}|\t)\S/m);
	});

	it("comments survive byte for byte", () => {
		const input = [
			"{",
			"  // my model",
			'  "model": "opus", /* keep */',
			'  "hooks": {',
			"    // my stop hook",
			'    "Stop": [{ "hooks": [{ "type": "command", "command": "echo mine" }] }]',
			"  }",
			"}",
			"",
		].join("\n");
		const result = planOutdated(input);
		expect(result.events).toEqual(EVENTS);
		for (const kept of ["// my model", "/* keep */", "// my stop hook", '"command": "echo mine"']) {
			expect(result.merged).toContain(kept);
		}
		expect(result.merged.endsWith("  }\n}\n")).toBe(true);
	});

	it("a compact single-line file keeps its own bytes", () => {
		const input = '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"echo mine"}]}]}}';
		const result = planOutdated(input);
		expect(result.merged).toContain('"Stop":[{"hooks":[{"type":"command","command":"echo mine"}]}');
		expect(parse(result.merged).hooks.Stop[0].hooks[0].command).toBe("echo mine");
	});

	it("a trailing comma in the file is tolerated", () => {
		expect(plan('{\n  "hooks": {\n    "Stop": [],\n  },\n}\n').state).toBe("outdated");
	});

	it("applying the merged text and planning again is complete, and AIDE's command is never added twice", () => {
		const old = { hooks: [{ type: "command", command: "aidemd-mcp hook" }] };
		const inputs = [
			"{}",
			'{ "model": "x" }',
			JSON.stringify({ hooks: wiredHooks(["Stop", "SessionStart"]) }, null, 2),
			JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }, null, "\t"),
			JSON.stringify({ hooks: { Stop: [old], SessionEnd: [old] } }, null, 2),
		];
		for (const input of inputs) {
			const first = planOutdated(input);
			expect(plan(first.merged)).toEqual({ state: "complete" });
			expect(count(first.merged, ESCAPED_COMMAND)).toBe(EVENTS.length);
		}
	});
});

describe("mergeLocal: malformed", () => {
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

	it("names the wrongly shaped event", () => {
		expect(plan('{ "hooks": { "Stop": {} } }')).toEqual({ state: "malformed", reason: '"hooks.Stop" is not an array' });
	});
});
