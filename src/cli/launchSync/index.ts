import { runSync } from "@/cli/sync/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";

/**
 * Launch the `sync` command: print help (exit 2) when `--help` is in argv,
 * otherwise run sync against the current project root and exit with its
 * code; a thrown error is reported on stderr and exits 1.
 *
 * Moved verbatim from the sync branch of the old `routeSubcommand` so sync's
 * output and exit codes stay byte-identical.
 */
export default async function launchSync(): Promise<void> {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			`Usage: ${aidePackage.command} sync (global)\n` +
				`       npx -y ${aidePackage.name}@<version> sync (local)\n\n` +
				"Reads `.aide/config/brain.aide` from the current project root, derives the brain\n" +
				"MCP server entry by interpolating the configured brain root path into the\n" +
				"mcpServerConfig.args template, and writes the result into `.mcp.json` under\n" +
				"the fixed `brain` key. Every other key in `mcpServers` (including any `aide`\n" +
				"entry, personal MCP integrations, etc.) is left byte-identical. If an\n" +
				"obsolete `obsidian` key is present it is removed in the same write.\n\n" +
				"Sync is idempotent — running it twice in succession produces the same\n" +
				"`.mcp.json` bytes, and the second invocation prints 'already in sync'.\n\n" +
				"Run sync after editing `.aide/config/brain.aide` to propagate your changes:\n" +
				`  ${aidePackage.command} sync (global)\n` +
				`  npx -y ${aidePackage.name}@<version> sync (local)\n\n` +
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
}
