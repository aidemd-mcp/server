import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Aborts the versions.json build when the git clone is shallow.
 *
 * A depth-1 checkout makes `git log --follow` see only HEAD, so every artifact
 * gets `sourceCommit` = HEAD and no `previousCommit`, and every host would then
 * report every artifact as outdated. This is the build-time counterpart of the
 * script's zero-artifacts abort. Build-time only, like `enumerateArtifacts` —
 * nothing reads it at runtime.
 *
 * Fails closed: anything other than an exact `"false"` answer throws, so a
 * manifest of unknown history depth never ships. A failure to run git at all
 * propagates unchanged.
 */
export default async function assertFullClone(repoRoot: string): Promise<void> {
	const { stdout } = await execFileAsync("git", ["rev-parse", "--is-shallow-repository"], { cwd: repoRoot });
	const output = stdout.trim();
	if (output === "false") return;
	if (output === "true") {
		throw new Error(
			"build-versions: shallow git clone detected — versions.json needs full history to resolve per-artifact commits (check out with fetch-depth: 0)",
		);
	}
	// Git older than 2.15 echoes the flag back instead of answering.
	throw new Error(
		`build-versions: could not determine whether the clone is shallow (git rev-parse --is-shallow-repository printed "${output}")`,
	);
}
