import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import renderReadme from "./renderReadme/index.js";

/**
 * Rewrites the aide-tools section of README.md from the tool reference pages.
 * The README is located from this file, not from the working directory, so the
 * command works from anywhere. The file is written only when the rendered text
 * differs from what is on disk; a missing or doubled marker rejects before any
 * write, so a failed run leaves the README untouched.
 */
export default async function buildReadme(): Promise<void> {
	const readmePath = fileURLToPath(new URL("../../README.md", import.meta.url));

	const readme = readFileSync(readmePath, "utf8");
	const rendered = renderReadme({ readme });

	if (rendered === readme) {
		process.stdout.write(`README.md already up to date: ${readmePath}\n`);
		return;
	}

	writeFileSync(readmePath, rendered, "utf8");
	process.stdout.write(`README.md updated: ${readmePath}\n`);
}

await buildReadme();
