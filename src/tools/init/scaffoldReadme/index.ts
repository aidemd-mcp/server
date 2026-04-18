import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import deriveProjectName from "./deriveProjectName/index.js";
import insertBadge, { BADGE_LINE, BADGE_DETECTION } from "./insertBadge/index.js";

/**
 * Ensure the host project has a README.md with the AIDE badge at the top.
 *
 * Single conditional gate: check if README.md exists at `projectRoot`.
 *
 * **README absent (create path):** Derives the project name from package.json
 * or the folder name and composes a minimal but authored-feeling README with
 * the badge already at the top. Returns `would-create`.
 *
 * **README present (inject path):** Reads the existing content. If the badge
 * is already present (`BADGE_DETECTION` substring found), returns `exists`.
 * Otherwise calls `insertBadge` and returns `would-create` with the modified
 * content.
 *
 * The two statuses are `would-create` and `exists` — `would-skip` is never
 * returned because this category always has actionable work or it is already
 * done.
 */
export default async function scaffoldReadme(projectRoot: string): Promise<InitStep> {
	const readmePath = join(projectRoot, "README.md");

	const readmeExists = await access(readmePath)
		.then(() => true)
		.catch(() => false);

	if (!readmeExists) {
		// Create path: no README on disk — generate a minimal authored README.
		const projectName = await deriveProjectName(projectRoot);
		const content = [BADGE_LINE, "", `# ${projectName}`, "", "A brief description of what this project does.", ""].join(
			"\n",
		);

		return {
			name: "README",
			status: "would-create",
			category: "readme",
			filePath: readmePath,
			content,
		};
	}

	// Inject path: README exists — detect badge or inject it.
	const content = await readFile(readmePath, "utf-8");

	if (content.includes(BADGE_DETECTION)) {
		return {
			name: "README badge",
			status: "exists",
			category: "readme",
			filePath: readmePath,
		};
	}

	return {
		name: "README badge",
		status: "would-create",
		category: "readme",
		filePath: readmePath,
		content: insertBadge(content),
	};
}
