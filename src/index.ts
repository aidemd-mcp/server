#!/usr/bin/env node

/**
 * Package entry. Hands terminal subcommands (`init`, `sync`, `view`) to the cli
 * dispatcher and starts the MCP server only when none matched.
 *
 * Nothing from the MCP SDK or the tools may be imported statically here:
 * `aidemd-mcp init|sync|view` must never load the server, so the server is
 * loaded through a dynamic import only after the dispatcher returns false.
 */

import runCli from "@/cli/index.js";

if (!(await runCli(process.argv.slice(2)))) {
	const { default: startServer } = await import("./startServer/index.js");
	startServer().catch((error) => {
		console.error("Fatal:", error);
		process.exit(1);
	});
}
