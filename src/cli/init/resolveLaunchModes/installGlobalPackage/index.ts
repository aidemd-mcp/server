import { spawn } from "node:child_process";

/**
 * Runs the global install command with the terminal attached so the user sees
 * npm's output. Resolves true on exit code 0 and false on a non-zero exit or a
 * spawn error. Deliberate exception to "services throw": the caller falls back
 * to local on any failure, so a failed install is an answer, not an error.
 */
export default function installGlobalPackage(installCommand: string): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn(installCommand, { shell: true, stdio: "inherit" });
		child.on("error", () => resolve(false));
		child.on("exit", (code) => resolve(code === 0));
	});
}
