import isMainModule from "./isMainModule/index.js";

/**
 * Dispatch a terminal command. `args` is `process.argv.slice(2)`.
 *
 * Returns true when `args[0]` named a command (init, sync, view, hook) and it
 * ran; false otherwise, in which case the caller starts the MCP server.
 *
 * `hook` is the one command called by Claude Code hooks, not by a person: it
 * prints nothing and always exits 0, whatever happened inside. The process
 * exits as soon as the hook settles, so a keep-alive socket left by its ping
 * can never hold the process open.
 *
 * Each table entry lazy-loads only its own module with a dynamic import, so
 * running one command never loads another command or the MCP server. This
 * file must not import any command, the MCP SDK, `@/tools` or `@/service`
 * statically.
 *
 * When this file is the main script it runs the intent-tree explorer instead
 * of dispatching: launchers installed before the explorer moved to `cli/tree`
 * run `node <pkg>/dist/cli/index.js [root]`, `aide_upgrade` does not replace
 * `.aide/bin/aide-tree.mjs` and installs never overwrite it. New launchers
 * point at `cli/tree/index.js` directly. When imported, only `runCli` is
 * exported.
 */
export default async function runCli(args: string[]): Promise<boolean> {
	// Lookup table: command name -> loader that imports and runs that command only
	const COMMANDS: Record<"init" | "sync" | "view" | "hook", () => Promise<void>> = {
		init: async () => {
			await (await import("./init/index.js")).runInitCli();
		},
		sync: async () => {
			await (await import("./launchSync/index.js")).default();
		},
		view: async () => {
			const code = await (await import("./view/index.js")).default({
				args: args.slice(1),
				projectRoot: process.cwd(),
			});
			process.exit(code);
		},
		hook: async () => {
			try {
				await (await import("./hook/index.js")).default();
			} finally {
				process.exit(0);
			}
		},
	};

	// Not a command (no args, --root, unknown word): the caller starts the server
	const name = args[0];
	if (name === undefined || !Object.hasOwn(COMMANDS, name)) return false;

	// Run the one matching command
	await COMMANDS[name as keyof typeof COMMANDS]();
	return true;
}

// Old launchers run this file as the main script: the explorer runs itself on
// load and reads the project root from process.argv[2], where they put it
if (isMainModule({ moduleUrl: import.meta.url, entryPath: process.argv[1] })) {
	await import("./tree/index.js");
}
