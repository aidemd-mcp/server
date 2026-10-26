import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpPinMove, UpgradeFileResult } from "@/types/index.js";
import movePin from "./index.js";

const CHANGED_SINCE_CHECK =
	"The aide entry's version pin changed after it was checked, so it was not moved. Run aide_upgrade again to see the current pin before moving it.";
const NOT_BYTE_SAFE =
	"The MCP config could not be edited byte-safely, so the aide entry's pin was not moved to 0.13.1 and nothing was written. Tell the user the entry is unchanged.";

const PIN_MOVE: McpPinMove = { from: "0.12.0", to: "0.13.1" };
const OLD = "@aidemd-mcp/server@0.12.0";
const NEW = "@aidemd-mcp/server@0.13.1";

let dir: string;
let filePath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "movepin-"));
	filePath = join(dir, ".mcp.json");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function makeFile(pinMove: McpPinMove = PIN_MOVE): UpgradeFileResult & { pinMove: McpPinMove } {
	return { name: ".mcp.json", filePath, status: "differs", category: "mcp", pinMove };
}

/** Builds a config text with the given args for the aide entry. */
function configWith({
	command = "npx",
	args,
	indent = "  ",
	eol = "\n",
	trailing = "\n",
}: {
	command?: string;
	args: string[];
	indent?: string;
	eol?: string;
	trailing?: string;
}): string {
	const lines = [
		"{",
		`${indent}"extra": true,`,
		`${indent}"mcpServers": {`,
		`${indent}${indent}"brain": { "command": "npx", "args": ["-y", "${OLD}"] },`,
		`${indent}${indent}"aide": {`,
		`${indent}${indent}${indent}"command": ${JSON.stringify(command)},`,
		`${indent}${indent}${indent}"args": ${JSON.stringify(args)}`,
		`${indent}${indent}},`,
		`${indent}${indent}"other": { "command": "node", "args": ["x.js"] }`,
		`${indent}}`,
		"}",
	];
	return lines.join(eol) + trailing;
}

describe("movePin — moves only the spec token", () => {
	it.each([
		{ label: "direct", command: "npx", args: ["-y", OLD], from: "0.12.0" as string | null },
		{ label: "wrapped cmd", command: "cmd", args: ["/c", "npx", "-y", OLD], from: "0.12.0" },
		{ label: "--yes", command: "npx", args: ["--yes", OLD], from: "0.12.0" },
		{ label: "no -y", command: "npx", args: [OLD], from: "0.12.0" },
		{ label: "bare spec", command: "npx", args: ["-y", "@aidemd-mcp/server"], from: null },
	])("$label", async ({ command, args, from }) => {
		const original = configWith({ command, args });
		await writeFile(filePath, original, "utf-8");
		const oldSpec = args.find((arg) => arg.startsWith("@aidemd-mcp/server"))!;

		const pinMove = { from, to: "0.13.1" };
		const result = await movePin(makeFile(pinMove));

		// the brain entry carries the same OLD string and must stay as it was
		const aideStart = original.indexOf('"aide"');
		const expected =
			original.slice(0, aideStart) +
			original.slice(aideStart).replace(`"${oldSpec}"`, `"${NEW}"`);
		expect(await readFile(filePath, "utf-8")).toBe(expected);
		expect(result.status).toBe("updated");
		expect(result.pinMove).toEqual(pinMove);
		expect(result.prescription).toBeUndefined();
		expect(result.instructions).toBeUndefined();
	});
});

describe("movePin — preserves every other byte", () => {
	it.each([
		{ label: "CRLF with tabs", indent: "\t", eol: "\r\n", trailing: "\r\n" },
		{ label: "LF, no trailing newline", indent: "  ", eol: "\n", trailing: "" },
		{ label: "LF, trailing newline", indent: "    ", eol: "\n", trailing: "\n" },
	])("$label", async ({ indent, eol, trailing }) => {
		const original = configWith({ args: ["-y", OLD], indent, eol, trailing });
		await writeFile(filePath, original, "utf-8");

		await movePin(makeFile());

		const aideStart = original.indexOf('"aide"');
		const expected =
			original.slice(0, aideStart) + original.slice(aideStart).replace(OLD, NEW);
		expect(await readFile(filePath, "utf-8")).toBe(expected);
	});

	it("leaves another server with the identical spec string byte-identical", async () => {
		const original = configWith({ args: ["-y", OLD] });
		await writeFile(filePath, original, "utf-8");

		await movePin(makeFile());

		const after = await readFile(filePath, "utf-8");
		expect(JSON.parse(after).mcpServers.brain.args).toEqual(["-y", OLD]);
		expect(after.indexOf(`"brain": { "command": "npx", "args": ["-y", "${OLD}"] },`)).toBeGreaterThan(-1);
	});
});

describe("movePin — refusals leave the file byte-identical", () => {
	it("refuses when the pin on disk is not pinMove.from", async () => {
		const original = configWith({ args: ["-y", "@aidemd-mcp/server@0.11.0"] });
		await writeFile(filePath, original, "utf-8");

		const result = await movePin(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(CHANGED_SINCE_CHECK);
	});

	it("refuses when the aide entry was removed", async () => {
		const original = JSON.stringify({ mcpServers: { brain: { command: "npx", args: ["-y", OLD] } } }, null, 2);
		await writeFile(filePath, original, "utf-8");

		const result = await movePin(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(CHANGED_SINCE_CHECK);
	});

	it("refuses a duplicate aide key as not byte-safe", async () => {
		const original = [
			"{",
			'  "mcpServers": {',
			`    "aide": { "command": "npx", "args": ["-y", "${OLD}"] },`,
			`    "aide": { "command": "npx", "args": ["-y", "${OLD}"] }`,
			"  }",
			"}",
		].join("\n");
		await writeFile(filePath, original, "utf-8");

		const result = await movePin(makeFile());

		expect(await readFile(filePath, "utf-8")).toBe(original);
		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(NOT_BYTE_SAFE);
	});

	it("refuses a missing file as not byte-safe", async () => {
		const result = await movePin(makeFile());

		expect(result.status).toBe("differs");
		expect(result.instructions).toBe(NOT_BYTE_SAFE);
	});
});

describe("movePin — the written spec", () => {
	it("is always @aidemd-mcp/server@<to>, never a rebuilt entry", async () => {
		const original = configWith({ command: "cmd", args: ["/c", "npx", "-y", OLD] });
		await writeFile(filePath, original, "utf-8");

		await movePin(makeFile());

		const aide = JSON.parse(await readFile(filePath, "utf-8")).mcpServers.aide;
		expect(aide.command).toBe("cmd");
		expect(aide.args).toEqual(["/c", "npx", "-y", NEW]);
		expect(JSON.stringify(aide)).not.toContain("latest");
	});
});
