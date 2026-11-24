import { spawn, type ChildProcess } from "node:child_process";

/**
 * Starts this project's observer as a detached child running the package's own
 * entry script (`view --port <port>`), so the spawned observer is this exact
 * version and outlives the MCP server. `unref()` keeps the server from waiting
 * on it. Never adds `--brain` and never passes any port but the one given.
 *
 * Keeps an `"error"` listener on the child for its whole life: a spawn failure
 * (`ENOENT`, `EACCES`) is emitted asynchronously, and with no listener Node
 * throws it as an unhandled event and takes the MCP server down. The listener
 * does nothing with the error; telling the caller is `awaitObserver`'s job.
 */
export default function launchObserver({
	root,
	port,
	entryScript,
}: {
	root: string;
	port: number;
	entryScript: string;
}): ChildProcess {
	const child = spawn(process.execPath, [entryScript, "view", "--port", String(port)], {
		cwd: root,
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	});
	child.on("error", () => {});
	child.unref();
	return child;
}
