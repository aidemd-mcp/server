import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In dist this module lives at dist/observer/locatePageAssets/index.js and in source at
 * src/observer/locatePageAssets/index.ts; walking up 3 directories reaches the package root
 * from both (the same rule as readPackageVersion).
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(MODULE_DIR, "..", "..", "..");

/**
 * Where the bundled page script and stylesheet live: `<package root>/dist/observer/assets`.
 * Pure path math, no file access; the asset route reads from here and answers 503 when the
 * bundle has not been built.
 */
export default function locatePageAssets(): string {
	return join(PACKAGE_ROOT, "dist", "observer", "assets");
}
