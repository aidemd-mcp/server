import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import enumerateArtifacts from "@/tools/upgrade/buildVersionsMeta/enumerateArtifacts/index.js";
import type {
	VersionMeta,
	VersionsMap,
} from "@/tools/upgrade/buildVersionsMeta/index.js";

const execFileAsync = promisify(execFile);

/**
 * Repo root is process.cwd() — this script is always invoked from the repo
 * root via a package.json script, so cwd is stable and correct. Unlike the
 * runtime reader (which must use import.meta.url because it runs inside the
 * host's cwd), the build script controls its own launch context.
 */
const REPO_ROOT = process.cwd();

/**
 * Query git log for the last two commits touching a given repo-relative path.
 * Returns the raw stdout string, or throws if git is unavailable.
 */
async function gitLogForPath(repoPath: string): Promise<string> {
	const { stdout } = await execFileAsync(
		"git",
		["log", "--follow", "--format=%H %aI", "-n", "2", "--", repoPath],
		{ cwd: REPO_ROOT },
	);
	return stdout;
}

/**
 * Parse git log stdout into a VersionMeta entry. Returns undefined when the
 * file has no commit history (e.g. newly added, untracked).
 */
function parseGitLog(stdout: string): VersionMeta | undefined {
	const lines = stdout.trim().split("\n").filter(Boolean);
	if (lines.length === 0) return undefined;

	const [latestSha, latestDate] = lines[0].split(" ", 2);
	const meta: VersionMeta = {
		publishedAt: latestDate,
		sourceCommit: latestSha.slice(0, 7),
	};

	if (lines.length > 1) {
		const [priorSha] = lines[1].split(" ", 2);
		meta.previousCommit = priorSha.slice(0, 7);
	}

	return meta;
}

async function main(): Promise<void> {
	const artifacts = enumerateArtifacts();
	const result: VersionsMap = {};

	// Verify git is reachable before iterating — a single failure here means
	// the git binary is absent and the entire manifest would be empty.
	try {
		await execFileAsync("git", ["--version"], { cwd: REPO_ROOT });
	} catch (cause) {
		process.stderr.write("build-versions: git is not available\n");
		process.exit(1);
	}

	for (const artifact of artifacts) {
		try {
			const stdout = await gitLogForPath(artifact.repoPath);
			const meta = parseGitLog(stdout);
			if (meta === undefined) continue; // no commit history — skip
			result[artifact.slug] = meta;
		} catch {
			// Individual artifact failure (e.g. path not tracked) — skip slug.
			continue;
		}
	}

	if (Object.keys(result).length === 0) {
		process.stderr.write(
			"build-versions: zero artifacts resolved — aborting to prevent empty manifest\n",
		);
		process.exit(1);
	}

	const outDir = join(REPO_ROOT, "dist");
	mkdirSync(outDir, { recursive: true });
	const outPath = join(outDir, "versions.json");
	writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");

	const count = Object.keys(result).length;
	process.stderr.write(`versions.json: ${count} artifacts\n`);
}

main();
