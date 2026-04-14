#!/usr/bin/env node
import writeMcpEntry from "./writeMcpEntry/index.js";
import writeInitCommand from "./writeInitCommand/index.js";
import writeAideTree from "./writeAideTree/index.js";

const MCP_LABEL = ".mcp.json";
const CMD_LABEL = ".claude/commands/aide/init.md";
const TREE_LABEL = ".aide/bin/aide-tree.mjs";

export async function runInit(
	cwd: string,
	write: (line: string) => void = (line) => process.stdout.write(line + "\n"),
): Promise<number> {
	const mcpResult = await writeMcpEntry(cwd);
	const cmdResult = await writeInitCommand(cwd);
	const treeResult = await writeAideTree(cwd);

	write(`[${mcpResult.status}] ${MCP_LABEL} — ${mcpResult.message}`);
	write(`[${cmdResult.status}] ${CMD_LABEL} — ${cmdResult.message}`);
	write(`[${treeResult.status}] ${TREE_LABEL} — ${treeResult.message}`);

	if (
		mcpResult.status === "exists" &&
		cmdResult.status === "exists" &&
		treeResult.status === "exists"
	) {
		write("Already set up. Run /aide:init in Claude Code to continue.");
		return 0;
	}

	write("Done. Open Claude Code and run /aide:init to complete setup.");
	return 0;
}

(async () => {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			"Usage: npx @aidemd-mcp/server init\n" +
				"Wires the AIDE MCP server, init command, and aide-tree into the current project.\n",
		);
		process.exit(0);
	}

	try {
		const code = await runInit(process.cwd());
		process.exit(code);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}
})();
