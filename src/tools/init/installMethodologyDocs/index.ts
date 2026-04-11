import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import {
	readCanonicalDoc,
	listMethodologyDocs,
} from "@/tools/init/initContent/index.js";

/** Check if a file exists on disk. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Install the canonical AIDE methodology docs into the host's doc hub.
 *
 * Each canonical doc named by `listMethodologyDocs()` — including the
 * hub index — is written verbatim into a single file under `docHubDir`.
 * Existing files are preserved and reported as `exists` so user
 * customizations survive re-runs; a failing read of one canonical doc
 * is reported as `skipped` for that single entry and does not cascade
 * into the other installs. Every byte of methodology content is sourced
 * through `readCanonicalDoc` — this helper never reads canonical files
 * directly, which is the chokepoint invariant the init subtree depends
 * on.
 */
export default async function installMethodologyDocs(
	docHubDir: string,
	displayPrefix: string = ".aide",
): Promise<InitStepResult[]> {
	const results: InitStepResult[] = [];
	await mkdir(docHubDir, { recursive: true });

	// Install each canonical methodology doc as its own host-side file.
	// Per-file idempotency + per-file reporting, no cascade on read failure:
	// the helper's spec names this as the exact shape scaffoldCommands already
	// uses, and the consistency across installers is deliberate.
	for (const entry of listMethodologyDocs()) {
		const targetPath = join(docHubDir, entry.hostFilename);
		const displayName = `${displayPrefix}/${entry.hostFilename}`;

		if (await fileExists(targetPath)) {
			results.push({ name: displayName, status: "exists" });
			continue;
		}

		let content: string;
		try {
			content = readCanonicalDoc(entry.canonical);
		} catch {
			results.push({ name: displayName, status: "skipped" });
			continue;
		}

		await writeFile(targetPath, content, "utf-8");
		results.push({ name: displayName, status: "created" });
	}

	return results;
}
