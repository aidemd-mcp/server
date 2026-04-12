import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { listMethodologyDocs } from "@/tools/init/initContent/index.js";

const execFileAsync = promisify(execFile);

/** Git-derived version metadata for a single methodology doc. */
export interface VersionMeta {
	/** ISO 8601 author timestamp of the last commit touching this doc. */
	publishedAt: string;
	/** 7-char short SHA of the last commit touching this doc. */
	sourceCommit: string;
	/** 7-char short SHA of the prior commit touching this doc, if one exists. */
	previousCommit?: string;
}

/** Map of doc slug → version metadata. */
export type VersionsMap = Record<string, VersionMeta>;

/**
 * Repo root resolved from this module's location. Same 4-hop walk as
 * initContent — src/ and dist/ are siblings under the repo root at the
 * same depth (src/tools/upgrade/buildVersionsMeta or
 * dist/tools/upgrade/buildVersionsMeta).
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(MODULE_DIR, "..", "..", "..", "..");

/**
 * Extract git commit metadata for each methodology doc from this repo's
 * own history. Returns a map keyed by doc slug (filename without .md).
 *
 * Uses `git log --follow` so history survives file renames. Gracefully
 * returns an empty object if git is unavailable, and omits individual
 * slugs whose files have no commit history (e.g. newly added, untracked).
 */
export default async function buildVersionsMeta(): Promise<VersionsMap> {
	const docs = listMethodologyDocs();
	const result: VersionsMap = {};

	for (const entry of docs) {
		const slug = entry.hostFilename.replace(/\.md$/, "");
		const docPath = `.aide/docs/${entry.hostFilename}`;

		try {
			const { stdout } = await execFileAsync(
				"git",
				["log", "--follow", "--format=%H %aI", "-n", "2", "--", docPath],
				{ cwd: REPO_ROOT },
			);

			const lines = stdout.trim().split("\n").filter(Boolean);
			if (lines.length === 0) continue;

			const [latestSha, latestDate] = lines[0].split(" ", 2);
			const meta: VersionMeta = {
				publishedAt: latestDate,
				sourceCommit: latestSha.slice(0, 7),
			};

			if (lines.length > 1) {
				const [priorSha] = lines[1].split(" ", 2);
				meta.previousCommit = priorSha.slice(0, 7);
			}

			result[slug] = meta;
		} catch {
			// Git unavailable or command failed for this file — skip slug.
			continue;
		}
	}

	return result;
}
