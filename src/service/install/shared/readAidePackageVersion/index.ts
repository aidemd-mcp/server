import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads the running package's own version from its `package.json`.
 *
 * The local aide entry is pinned to the version that wrote it, so every release
 * pins itself without a code edit. The file is resolved from this module's own
 * location, five directories up (`readAidePackageVersion` -> `shared` ->
 * `install` -> `service` -> `dist` or `src` -> package root), which holds from
 * `dist/` and from `src/` under vitest.
 *
 * Throws when the file is unreadable or has no string `version`: a local entry
 * cannot be pinned without it.
 */
export default function readAidePackageVersion(): string {
	const packageJsonPath = join(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"..",
		"..",
		"..",
		"..",
		"package.json",
	);

	try {
		const { version } = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: unknown };
		if (typeof version !== "string") throw new Error("no string `version` field");
		return version;
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		throw new Error(`cannot read @aidemd-mcp/server version from ${packageJsonPath}: ${reason}`);
	}
}
