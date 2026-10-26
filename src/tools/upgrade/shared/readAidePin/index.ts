import type { NpxPackageSpec } from "@/types/index.js";
import readNpxPackageSpec from "@/service/install/shared/readNpxPackageSpec/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";

/**
 * The one reading of "the aide entry's npx pin", shared by detection
 * (checkMcpConfig) and the write (movePin) so the two can never disagree on
 * which argument is the pin. Returns null when the entry is not an npx launch of
 * this package in a form whose spec can be located (another package,
 * `-p`/`--package`, non-string args). Pure, never throws.
 */
export default function readAidePin(entry: unknown): NpxPackageSpec | null {
	if (typeof entry !== "object" || entry === null) return null;

	const { command, args } = entry as { command?: unknown; args?: unknown };
	if (typeof command !== "string") return null;
	if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) return null;

	const spec = readNpxPackageSpec({ command, args });
	if (spec === null) return null;
	if (spec.packageName !== aidePackage.name) return null;

	return spec;
}
