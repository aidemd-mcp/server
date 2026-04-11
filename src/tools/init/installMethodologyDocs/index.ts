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
 * Compose the host-side hub index from the methodology enumeration.
 * The index is deliberately pure structure — a title and a bulleted
 * list of relative links to each canonical doc in the hub. No
 * sentence inside the body teaches an AIDE rule, because any teaching
 * content would be canonical doctrine and would need to come from
 * `docs/` rather than from this helper. The crawl trigger and the
 * progressive-disclosure instruction are already delivered at the
 * pointer surface (through `docs/methodology-stub.md`), so the index
 * can stay pure plumbing here without leaving any teaching gap.
 */
function composeHubIndex(entries: readonly { hostFilename: string }[]): string {
	const links = entries
		.map((e) => `- [${e.hostFilename}](./${e.hostFilename})`)
		.join("\n");
	return `# AIDE Methodology Doc Hub\n\n${links}\n`;
}

/**
 * Install the canonical AIDE methodology docs into the host's doc hub.
 *
 * Each canonical doc named by `listMethodologyDocs()` is written verbatim
 * into a single file under `docHubDir`, and a pure-structural hub index
 * is written alongside them. Existing files are preserved and reported
 * as `exists` so user customizations survive re-runs; a failing read of
 * one canonical doc is reported as `skipped` for that single entry and
 * does not cascade into the other installs. Every byte of methodology
 * content is sourced through `readCanonicalDoc` — this helper never
 * reads `docs/` directly, which is the chokepoint invariant the init
 * subtree depends on.
 */
export default async function installMethodologyDocs(
	docHubDir: string,
): Promise<InitStepResult[]> {
	const results: InitStepResult[] = [];
	await mkdir(docHubDir, { recursive: true });

	const entries = listMethodologyDocs();

	// Install each canonical methodology doc as its own host-side file.
	// Per-file idempotency + per-file reporting, no cascade on read failure:
	// the helper's spec names this as the exact shape scaffoldCommands already
	// uses, and the consistency across installers is deliberate.
	for (const entry of entries) {
		const targetPath = join(docHubDir, entry.hostFilename);
		const displayName = `.aide/${entry.hostFilename}`;

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

	// Hub index: idempotent on the same rule, but composed locally because
	// its content is pure structure (title + list of relative links), not
	// canonical doctrine.
	const indexPath = join(docHubDir, "index.md");
	const indexDisplayName = ".aide/index.md";
	if (await fileExists(indexPath)) {
		results.push({ name: indexDisplayName, status: "exists" });
	} else {
		await writeFile(indexPath, composeHubIndex(entries), "utf-8");
		results.push({ name: indexDisplayName, status: "created" });
	}

	return results;
}
