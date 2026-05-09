import parseBrainAide, { interpolateArgs } from "@/service/parseBrainAide/index.js";
import writeMcpEntry from "@/cli/shared/writeMcpEntry/index.js";

/** Type guard that narrows `(string | null)[]` to `string[]` after the null-refusal precondition has verified every element is non-null. */
function isAllStrings(args: (string | null)[]): args is string[] {
	return args.every((a) => a !== null);
}

/**
 * Propagates `.aide/config/brain.aide` into the host's `.mcp.json` under the fixed
 * `brain` key.
 *
 * Refuses null-bearing args at the boundary — when any element of
 * `mcpServerConfig.args` is null after interpolation, exits non-zero and names the
 * offending index(es) in stderr, routing the user to `/aide:brain config`.
 * `.mcp.json` is not touched on this path.
 *
 * Exit-code contract:
 * - 0 on success, including the no-change case ("already in sync" is success).
 * - 1 on any file failure: brain.aide missing/malformed, null-bearing args,
 *   `.mcp.json` invalid JSON, or write error.
 * - 2 on `--help` or invalid argv (handled by the IIFE before `runSync` is called).
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
			"No `.aide/config/brain.aide` found. Run `npx @aidemd-mcp/server@latest init` to scaffold it, or create the file by hand.",
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

	// Step 2 — Compute the post-interpolation args. interpolateArgs substitutes
	// any ${<key>} placeholders in mcpServerConfig.args against frontmatter fields.
	const args = interpolateArgs({ name: result.name, mcpServerConfig: result.mcpServerConfig });

	// Step 3 — Null-bearing-args precondition. Walk args element-by-element and
	// collect every index whose element is null. The check uses strict identity
	// (=== null) — not truthiness, not string equality against the literal "null".
	// YAML null is JS null and only JS null; any other test would reintroduce the
	// retired literal-sentinel regression class.
	//
	// This precondition runs BEFORE any .mcp.json I/O. `.mcp.json` is not read or
	// written on the null-refusal path.
	const nullIndexes: number[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === null) nullIndexes.push(i);
	}
	if (nullIndexes.length > 0) {
		const slots = nullIndexes.map((i) => `args[${i}] is null`).join(", ");
		writeErr(
			`\`.aide/config/brain.aide\` has unwired slots: ${slots}. Run \`/aide:brain config\` to fill the unwired slot(s).`,
		);
		return 1;
	}

	// Step 4 — Compose expectedEntry. The null-refusal precondition above has
	// verified at runtime that every element is non-null; isAllStrings narrows the
	// type from (string | null)[] to string[] so writeMcpEntry's McpServerEntry
	// contract is satisfied without an unsafe cast.
	if (!isAllStrings(args)) {
		// Unreachable: the nullIndexes check above returns 1 when any null is present.
		// TypeScript cannot see through the early return, so this branch satisfies
		// narrowing. It is never executed.
		throw new Error("invariant violated: null entry in args after null-refusal precondition");
	}

	const expectedEntry = {
		command: result.mcpServerConfig.command,
		args,
	};

	// Step 5 — Build the entries map. The map carries exactly one key: `brain`.
	const entries: Record<string, typeof expectedEntry> = {
		brain: expectedEntry,
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
	write("Done.");
	return 0;
}

