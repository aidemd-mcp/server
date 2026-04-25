import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Derive a human-readable project name for use in a generated README heading.
 *
 * Two-source fallback, in order of preference:
 *
 * 1. **package.json `name` field** — if `projectRoot` contains a `package.json`
 *    with a non-empty `name` field, that value is returned verbatim. The authored
 *    name is preferred because it reflects what the developer deliberately chose
 *    to call the project; folder names drift over time (clones, monorepo nesting,
 *    local rename conventions) while the manifest name stays stable.
 *
 * 2. **Folder name** — if no package.json exists or the `name` field is missing
 *    or empty, the basename of `projectRoot` is used instead. Hyphens are split
 *    into words and each word is title-cased, so `my-cool-project` becomes
 *    `My Cool Project`. This matches the most common Node/GitHub naming convention
 *    and produces a readable heading without requiring a manifest.
 */
export default async function deriveProjectName(projectRoot: string): Promise<string> {
	try {
		const pkgPath = join(projectRoot, "package.json");
		const raw = await readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		if (typeof pkg.name === "string" && pkg.name.trim() !== "") {
			return pkg.name.trim();
		}
	} catch {
		// package.json absent or unreadable — fall through to folder name.
	}

	const folderName = basename(projectRoot);
	return folderName
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
