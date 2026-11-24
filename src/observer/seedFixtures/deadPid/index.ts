import { spawn } from "node:child_process";

/**
 * Returns the pid of a child process that has already exited, so a fixture session recorded with it
 * is one whose process is gone. Rejects when the child cannot be started or has no pid.
 */
export default async function deadPid(): Promise<number> {
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	const pid = child.pid;

	await new Promise<void>((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", () => resolve());
	});

	if (pid === undefined) throw new Error("The helper process reported no pid.");
	return pid;
}
