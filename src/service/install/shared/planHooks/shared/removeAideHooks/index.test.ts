import { describe, it, expect } from "vitest";
import { parse } from "jsonc-parser";
import removeAideHooks from "./index.js";

const AIDE_COMMAND = "aidemd-mcp hook";
const NODE_COMMAND = "node \"C:/npm/node_modules/@aidemd-mcp/server/dist/index.js\" hook";
const USER_COMMAND = "prettier --write .";

function run({ text, events }: { text: string; events?: ReadonlySet<string> }): string {
	return removeAideHooks({ text, settings: parse(text, [], { allowTrailingComma: true }), events });
}

describe("removeAideHooks", () => {
	it("removes an event key whose only group is AIDE's", () => {
		const text = JSON.stringify(
			{ hooks: { Stop: [{ hooks: [{ type: "command", command: AIDE_COMMAND }] }], PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: USER_COMMAND }] }] } },
			null,
			2,
		);
		const result = parse(run({ text }));
		expect(result).toEqual({ hooks: { PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: USER_COMMAND }] }] } });
	});

	it("removes only AIDE's element from a group shared with a user hook", () => {
		const text = JSON.stringify(
			{ hooks: { Stop: [{ hooks: [{ type: "command", command: USER_COMMAND }, { type: "command", command: NODE_COMMAND }] }] } },
			null,
			2,
		);
		expect(parse(run({ text }))).toEqual({
			hooks: { Stop: [{ hooks: [{ type: "command", command: USER_COMMAND }] }] },
		});
	});

	it("removes only AIDE's group when a user group sits beside it", () => {
		const text = JSON.stringify(
			{
				hooks: {
					Stop: [
						{ hooks: [{ type: "command", command: AIDE_COMMAND }] },
						{ hooks: [{ type: "command", command: USER_COMMAND }] },
						{ hooks: [{ type: "command", command: NODE_COMMAND }] },
					],
				},
			},
			null,
			2,
		);
		expect(parse(run({ text }))).toEqual({
			hooks: { Stop: [{ hooks: [{ type: "command", command: USER_COMMAND }] }] },
		});
	});

	it("removes the hooks key when AIDE's removal emptied it and leaves other keys byte-identical", () => {
		const permissions = "\"permissions\": {\n    \"allow\": [ \"Bash(ls)\" ]\n  }";
		const text = `{\n  ${permissions},\n  "hooks": {\n    "SessionStart": [{ "hooks": [{ "type": "command", "command": "${AIDE_COMMAND}" }] }],\n    "Stop": [{ "hooks": [{ "type": "command", "command": "${AIDE_COMMAND}" }] }]\n  }\n}\n`;
		const result = run({ text });
		expect(parse(result)).toEqual({ permissions: { allow: ["Bash(ls)"] } });
		expect(result).toContain(permissions);
		expect(result).not.toContain("hooks");
	});

	it("keeps an event array that was already empty", () => {
		const text = JSON.stringify(
			{ hooks: { Notification: [], Stop: [{ hooks: [{ type: "command", command: AIDE_COMMAND }] }] } },
			null,
			2,
		);
		expect(parse(run({ text }))).toEqual({ hooks: { Notification: [] } });
	});

	it("keeps a hooks object that was already empty", () => {
		const text = "{ \"hooks\": {} }";
		expect(run({ text })).toBe(text);
	});

	it("never touches a non-array event value or a non-command hook", () => {
		const text = JSON.stringify(
			{ hooks: { Stop: "aidemd-mcp hook", SessionEnd: [{ hooks: [{ type: "prompt", command: AIDE_COMMAND }, { type: "command" }] }] } },
			null,
			2,
		);
		expect(run({ text })).toBe(text);
	});

	it("keeps comments, CRLF line endings and indentation outside the removed ranges", () => {
		const text = [
			"{",
			"\t// keep this comment",
			"\t\"permissions\": { \"deny\": [] },",
			"\t\"hooks\": {",
			`\t\t"Stop": [ { "hooks": [ { "type": "command", "command": "${AIDE_COMMAND}" } ] } ],`,
			`\t\t"PostToolUse": [ { "matcher": "*", "hooks": [ { "type": "command", "command": "${USER_COMMAND}" } ] } ]`,
			"\t}",
			"}",
			"",
		].join("\r\n");
		const result = run({ text });
		expect(result).toContain("\t// keep this comment\r\n\t\"permissions\": { \"deny\": [] },\r\n");
		expect(result).toContain(`\t\t"PostToolUse": [ { "matcher": "*", "hooks": [ { "type": "command", "command": "${USER_COMMAND}" } ] } ]`);
		expect(result).not.toContain("aidemd-mcp");
		expect(result).not.toMatch(/(^|[^\r])\n/);
		expect(parse(result, [], { allowTrailingComma: true })).toEqual({
			permissions: { deny: [] },
			hooks: { PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: USER_COMMAND }] }] },
		});
	});

	it("touches only the events it is limited to", () => {
		const text = JSON.stringify(
			{
				hooks: {
					Stop: [{ hooks: [{ type: "command", command: AIDE_COMMAND }] }],
					SessionEnd: [{ hooks: [{ type: "command", command: AIDE_COMMAND }] }],
				},
			},
			null,
			2,
		);
		const result = run({ text, events: new Set(["SessionEnd"]) });
		expect(parse(result)).toEqual({ hooks: { Stop: [{ hooks: [{ type: "command", command: AIDE_COMMAND }] }] } });
	});

	it("returns identical text when no hook is AIDE's", () => {
		const text = `{\n  "hooks": {\n    "Stop": [{ "hooks": [{ "type": "command", "command": "${USER_COMMAND}" }] }]\n  }\n}\n`;
		expect(run({ text })).toBe(text);
	});

	it("returns identical text when the file has no hooks", () => {
		const text = "{ \"permissions\": {} }\n";
		expect(run({ text })).toBe(text);
	});
});
