import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In dist this module lives at dist/util/readPackageVersion/index.js.
 * Walking up 3 directories reaches the package root where package.json resides.
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = join(MODULE_DIR, "..", "..", "..", "package.json");

/**
 * Reads the running package's own `version` from its package.json, so the
 * observer, the start tool and the info tool all report the same number.
 * Returns "unknown" when the file cannot be read or holds no version; never throws.
 */
export default function readPackageVersion(): string {
	try {
		const raw = readFileSync(PACKAGE_JSON_PATH, "utf-8");
		const pkg = JSON.parse(raw) as { version?: string };
		return pkg.version ?? "unknown";
	} catch {
		return "unknown";
	}
}
