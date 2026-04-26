#!/usr/bin/env node
import parseBrainAide, { interpolateArgs } from "@/service/parseBrainAide/index.js";
import writeMcpEntry from "@/cli/shared/writeMcpEntry/index.js";

/**
 * Propagates `.aide/config/brain.aide` into the host's `.mcp.json` under the fixed
 * `brain` key. Also removes the legacy `obsidian` key when present (one-way
 * migration).
 *
 * Exit-code contract:
 * - 0 on success, including the no-change case ("already in sync" is success).
 * - 1 on any file failure: brain.aide missing/malformed, `.mcp.json` invalid JSON,
 *   or write error.
 *
 * Visible-command-boundary invariant: this is the ONLY path in the package that
 * mutates `.mcp.json`'s `brain` entry. The MCP server never rewrites the file
 * silently; every change is a command the user typed with output they saw.
 *
 * @param cwd      Absolute path to the host project root. Both `.aide/config/brain.aide`
 *                 and `.mcp.json` are resolved relative to this path.
 * @param write    Line-writer for stdout; defaults to `process.stdout.write`.
 *                 Injected for tests so stdout can be captured per test.
 * @param writeErr Line-writer for stderr; defaults to `process.stderr.write`.
 *                 Injected for tests so stderr can be captured per test.
 */
export async function runSync(
	cwd: string,
	write: (line: string) => void = (line) => process.stdout.write(line + "\n"),
	writeErr: (line: string) => void = (line) => process.stderr.write(line + "\n"),
): Promise<number> {
	// Step 1 — Parse .aide/config/brain.aide. Branch immediately on each failure kind so the
	// error message names exactly what is wrong and what the user should do.
	const result = await parseBrainAide(cwd);

	if (result.kind === "missing") {
		writeErr(
			"No `.aide/config/brain.aide` found. Run `npx aidemd-mcp init` to scaffold it, or create the file by hand.",
		);
		return 1;
	}

	if (result.kind === "malformed-frontmatter") {
		writeErr(
			`\`.aide/config/brain.aide\` frontmatter is malformed: ${result.reason}. Fix the YAML and re-run sync.`,
		);
		return 1;
	}

	if (result.kind === "malformed-body") {
		writeErr(
			`\`.aide/config/brain.aide\` has a malformed body: ${result.reason}. Fix the file and re-run sync.`,
		);
		return 1;
	}

	// Step 2 — Compute the expected MCP entry. interpolateArgs substitutes
	// any ${<key>} placeholders in mcpServerConfig.args against frontmatter fields.
	const expectedEntry = {
		command: result.config.mcpServerConfig.command,
		args: interpolateArgs(result.config),
	};

	// Step 3 — Build the entries map. Always set brain; always request obsidian
	// deletion. The helper treats "delete a key that isn't present" as a no-op,
	// so including obsidian unconditionally is safe.
	const entries: Record<string, typeof expectedEntry | "delete"> = {
		brain: expectedEntry,
		obsidian: "delete",
	};

	// Step 4 — Write (or confirm no-op). Catch the malformed-JSON throw and
	// translate it to a user-facing stderr line.
	let writeResult: Awaited<ReturnType<typeof writeMcpEntry>>;
	try {
		writeResult = await writeMcpEntry(cwd, entries);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		// Re-throw anything that isn't the "invalid JSON" sentinel.
		if (!message.includes("invalid JSON")) {
			throw err;
		}
		writeErr("`.mcp.json` exists but contains invalid JSON. Fix the syntax error and re-run sync.");
		return 1;
	}

	// Step 5 — Report outcome. Distinguish "already in sync" from "wrote changes".
	write("Read .aide/config/brain.aide");
	if (writeResult.unchanged) {
		write(".mcp.json already in sync — no changes.");
		return 0;
	}

	write("Wrote brain MCP entry into .mcp.json");
	write(`  command: ${expectedEntry.command}`);
	write(`  args: [${expectedEntry.args.join(", ")}]`);
	if (writeResult.deleted.includes("obsidian")) {
		write("Removed legacy `obsidian` MCP key (migrated to `brain`)");
	}
	write("Done.");
	return 0;
}

(async () => {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			"Usage: npx aidemd-mcp sync\n\n" +
				"Reads `.aide/config/brain.aide` from the current project root, derives the brain\n" +
				"MCP server entry by interpolating the configured vault path into the\n" +
				"mcpServerConfig.args template, and writes the result into `.mcp.json` under\n" +
				"the fixed `brain` key. Every other key in `mcpServers` (including any `aide`\n" +
				"entry, personal MCP integrations, etc.) is left byte-identical. If an\n" +
				"obsolete `obsidian` key is present it is removed in the same write.\n\n" +
				"Sync is idempotent — running it twice in succession produces the same\n" +
				"`.mcp.json` bytes, and the second invocation prints 'already in sync'.\n\n" +
				"Run sync after editing `.aide/config/brain.aide` to propagate your changes:\n" +
				"  npx aidemd-mcp sync\n\n" +
				"Sync accepts no flags other than --help. Both paths are conventional:\n" +
				"  brain.aide  →  <cwd>/.aide/config/brain.aide\n" +
				"  mcp config  →  <cwd>/.mcp.json\n",
		);
		process.exit(2);
	}

	try {
		const code = await runSync(process.cwd());
		process.exit(code);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}
})();
