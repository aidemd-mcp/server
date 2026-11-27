import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitPathStatus } from "@/types/index.js";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 5000;

/**
 * Asks git whether one path is ignored and whether it is tracked. `path` is
 * relative to `projectRoot` and forward-slashed. `git check-ignore --no-index`
 * counts every ignore source (nested .gitignore files, `.git/info/exclude`, the
 * user's global excludes) and keeps answering "ignored" for a tracked file once
 * its pattern exists; `git ls-files` says whether the path is tracked.
 *
 * Deliberate exception to "services throw", like `checkGlobalPackage`: every
 * other outcome (not a git work tree, git missing, a timeout, `ls-files`
 * failing) resolves `null`, because no git means there is nothing to cover.
 * Never throws.
 */
export default async function inspectGit(input: { projectRoot: string; path: string }): Promise<GitPathStatus | null> {
	const { projectRoot, path } = input;
	const options = { cwd: projectRoot, timeout: GIT_TIMEOUT_MS };
	try {
		const ignored = await checkIgnored(path, options);
		if (ignored === null) return null;
		const { stdout } = await execFileAsync("git", ["ls-files", "--", path], options);
		return { ignored, tracked: stdout.trim() !== "" };
	} catch {
		return null;
	}
}

/** check-ignore exits 0 when ignored and 1 when not; any other outcome is `null`. */
async function checkIgnored(path: string, options: { cwd: string; timeout: number }): Promise<boolean | null> {
	try {
		await execFileAsync("git", ["check-ignore", "--no-index", "-q", "--", path], options);
		return true;
	} catch (error) {
		if ((error as { code?: unknown }).code === 1) return false;
		return null;
	}
}
