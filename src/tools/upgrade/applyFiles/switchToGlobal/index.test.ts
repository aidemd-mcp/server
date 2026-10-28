import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpGlobalSwitch, UpgradeFileResult } from "@/types/index.js";

vi.mock("@/service/install/shared/checkGlobalPackage/index.js", () => ({
	default: vi.fn(),
}));

import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import switchToGlobal from "./index.js";

const mockCheck = checkGlobalPackage as ReturnType<typeof vi.fn>;

const NOT_INSTALLED =
	'@aidemd-mcp/server is not installed globally, so the aide entry was not switched and nothing was written. Run `npm i -g @aidemd-mcp/server`, confirm it succeeded, then call aide_upgrade with category "mcp" again.';
const NOT_BYTE_SAFE =
	"The MCP config could not be edited byte-safely, so the aide entry was not switched and nothing was written. Tell the user the entry is unchanged.";
const CHANGED_SINCE_CHECK =
	"The aide entry changed after it was checked, so it was not switched. Run aide_upgrade again to see its current state.";

const SPEC = "@aidemd-mcp/server@0.12.0";

let dir: string;
let filePath: string;

beforeEach(async () => {
	vi.clearAllMocks();
	mockCheck.mockResolvedValue(true);
	dir = await mkdtemp(join(tmpdir(), "switchtoglobal-"));
	filePath = join(dir, ".mcp.json");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function makeFile(key: "aide" | "aidemd-mcp" = "aide", installed = false): UpgradeFileResult & {
	globalSwitch: McpGlobalSwitch;
} {
	return {
		name: "MCP config",
		filePath,
		status: "differs",
		category: "mcp",
		globalSwitch: {
			key,
			name: "@aidemd-mcp/server",
			installed,
			installCommand: "npm i -g @aidemd-mcp/server",
		},
	};
}

/** Builds a config text whose entry under `key` is built from the given command line pieces. */
function configWith({
	key = "aide",
	commandLine,
	argsLine,
	extra = "",
	argsFirst = false,
	indent = "  ",
	eol = "\n",
}: {
	key?: string;
	commandLine: string;
	argsLine: string;
	extra?: string;
	argsFirst?: boolean;
	indent?: string;
	eol?: string;
}): string {
	const i2 = indent + indent;
	const i3 = indent + indent + indent;
	const command = `${i3}"command": ${commandLine}`;
	const args = `${i3}"args": ${argsLine}`;
	const members = (argsFirst ? [args, command] : [command, args]).join(`,${eol}`);
	const lines = [
		"{",
		`${indent}"mcpServers": {`,
		`${i2}"brain": { "command": "npx", "args": ["-y", "${SPEC}"] },`,
		`${i2}"${key}": {`,
		members + extra,
		`${i2}},`,
		`${i2}"other": { "command": "node", "args": ["x.js"] }`,
		`${indent}}`,
		"}",
	];
	return lines.join(eol) + eol;
}

/** Applies the expected switch to the text after the aide key, leaving the brain entry above it alone. */
function expectedSwitch(original: string, commandLine: string, argsLine: string): string {
	const start = original.indexOf('"aide"');
	return (
		original.slice(0, start) +
		original.slice(start).replace(commandLine, '"aidemd-mcp"').replace(argsLine, "[]")
	);
}

describe("switchToGlobal — replaces only the launch tokens", () => {
	it.each([
		{ label: "POSIX npx", commandLine: '"npx"', argsLine: `["-y", "${SPEC}"]` },
		{ label: "cmd /c npx", commandLine: '"cmd"', argsLine: `["/c", "npx", "-y", "${SPEC}"]` },
		{ label: "unpinned", commandLine: '"npx"', argsLine: '["-y", "@aidemd-mcp/server"]' },
	])("$label, under LF, CRLF and tab indentation", async ({ commandLine, argsLine }) => {
		for (const { indent, eol } of [
			{ indent: "  ", eol: "\n" },
			{ indent: "  ", eol: "\r\n" },
			{ indent: "\t", eol: "\n" },
		]) {
			const original = configWith({ commandLine, argsLine, indent, eol });
			await writeFile(filePath, original, "utf-8");

			const result = await switchToGlobal(makeFile());

			const expected = expectedSwitch(original, commandLine, argsLine);
			expect(await readFile(filePath, "utf-8")).toBe(expected);
			expect(result.status).toBe("updated");
			expect(result.globalSwitch).toMatchObject({ key: "aide", installed: true });
			expect(result.instructions).toBeUndefined();
			expect(result.prescription).toBeUndefined();
		}
	});

	it("switches the aidemd-mcp key in place and never renames it", async () => {
		const original = configWith({ key: "aidemd-mcp", commandLine: '"npx"', argsLine: `["-y", "${SPEC}"]` });
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile("aidemd-mcp"));

		const after = JSON.parse(await readFile(filePath, "utf-8"));
		expect(after.mcpServers["aidemd-mcp"]).toEqual({ command: "aidemd-mcp", args: [] });
		expect(after.mcpServers.aide).toBeUndefined();
		expect(result.status).toBe("updated");
		expect(result.globalSwitch?.key).toBe("aidemd-mcp");
	});

	it("leaves an env field on the entry and another server with the same strings untouched", async () => {
		const original = configWith({
			commandLine: '"npx"',
			argsLine: `["-y", "${SPEC}"]`,
			extra: `,\n      "env": { "A": "1" }`,
		});
		await writeFile(filePath, original, "utf-8");

		await switchToGlobal(makeFile());

		const text = await readFile(filePath, "utf-8");
		const after = JSON.parse(text);
		expect(after.mcpServers.aide).toEqual({ command: "aidemd-mcp", args: [], env: { A: "1" } });
		expect(after.mcpServers.brain.args).toEqual(["-y", SPEC]);
		expect(text).toContain(`"brain": { "command": "npx", "args": ["-y", "${SPEC}"] },`);
	});

	it("handles the command member after the args member", async () => {
		const original = configWith({ commandLine: '"npx"', argsLine: `["-y", "${SPEC}"]`, argsFirst: true });
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile());

		const expected = expectedSwitch(original, '"npx"', `["-y", "${SPEC}"]`);
		expect(await readFile(filePath, "utf-8")).toBe(expected);
		expect(result.status).toBe("updated");
	});
});

describe("switchToGlobal — refusals write nothing", () => {
	it("refuses when the package is not installed globally", async () => {
		mockCheck.mockResolvedValue(false);
		const original = configWith({ commandLine: '"npx"', argsLine: `["-y", "${SPEC}"]` });
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile("aide", true));

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.globalSwitch?.installed).toBe(false);
		expect(result.instructions).toBe(NOT_INSTALLED);
	});

	it("refuses when the entry is already global", async () => {
		const original = configWith({ commandLine: '"aidemd-mcp"', argsLine: "[]" });
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(CHANGED_SINCE_CHECK);
	});

	it("refuses when the entry was removed", async () => {
		const original = JSON.stringify({ mcpServers: { brain: { command: "npx", args: [] } } }, null, 2);
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.instructions).toBe(CHANGED_SINCE_CHECK);
	});

	it("refuses a duplicate aide key as not byte-safe", async () => {
		const entry = `{ "command": "npx", "args": ["-y", "${SPEC}"] }`;
		const original = `{\n  "mcpServers": {\n    "aide": ${entry},\n    "aide": ${entry}\n  }\n}`;
		await writeFile(filePath, original, "utf-8");

		const result = await switchToGlobal(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(NOT_BYTE_SAFE);
	});

	it("refuses a missing file as not byte-safe", async () => {
		const result = await switchToGlobal(makeFile());

		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(NOT_BYTE_SAFE);
	});
});
