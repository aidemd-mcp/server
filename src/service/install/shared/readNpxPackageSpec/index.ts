import type { BrainAideMcpServerConfig, NpxPackageSpec } from "@/types/index.js";
import normalizeLaunchedCommand from "@/service/install/shared/normalizeLaunchedCommand/index.js";

/** Matches the npx flags that replace the positional package spec (`-p`, `--package`, `--package=...`). */
const PACKAGE_FLAG = /^(-p|--package(=.*)?)$/;

/**
 * Locates the package spec npx launches inside an MCP server launcher (the brain
 * launcher, or the project's aide entry), so a caller can judge or move its
 * version without interpreting any other argument. Returns null when the
 * launcher is not npx, has no positional spec, or names its package with `-p`/`--package` (the user's own shape).
 * `argsStart` is 0 for the direct form and 2 for `cmd /c npx`; `autoConfirm`
 * counts `-y`/`--yes` only before the spec, since a later flag belongs to the
 * launched package. Pure.
 */
export default function readNpxPackageSpec(config: BrainAideMcpServerConfig): NpxPackageSpec | null {
	const launched = normalizeLaunchedCommand({ command: config.command, args: config.args });
	if (launched?.token !== "npx") return null;

	const isDirect = normalizeLaunchedCommand({ command: config.command, args: undefined })?.token === "npx";
	const argsStart = isDirect ? 0 : 2;

	const specIndex = config.args.findIndex(
		(arg, index) => index >= argsStart && typeof arg === "string" && !arg.startsWith("-"),
	);
	if (specIndex === -1) return null;

	const flags = config.args.slice(argsStart, specIndex);
	if (flags.some((arg) => typeof arg === "string" && PACKAGE_FLAG.test(arg))) return null;

	const spec = config.args[specIndex] as string;
	const versionAt = spec.lastIndexOf("@");
	const hasVersion = versionAt > 0;

	return {
		argsStart,
		specIndex,
		packageName: hasVersion ? spec.slice(0, versionAt) : spec,
		version: hasVersion ? spec.slice(versionAt + 1) : null,
		autoConfirm: flags.some((arg) => arg === "-y" || arg === "--yes"),
	};
}
