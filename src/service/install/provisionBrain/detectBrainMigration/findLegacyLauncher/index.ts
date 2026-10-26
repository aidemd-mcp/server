import type { BrainAideMcpServerConfig, BrainLauncherOffer, LegacyLauncherReason } from "@/types/index.js";
import { MCPVAULT_COMMAND, MCPVAULT_PACKAGE, MCPVAULT_VERSION } from "../../obsidianBrainAideTemplate/index.js";
import isOlderVersion from "@/service/install/shared/isOlderVersion/index.js";
import readNpxPackageSpec from "@/service/install/shared/readNpxPackageSpec/index.js";

/** Matches an exact `major.minor.patch` version. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Judges whether a brain launcher is a legacy bundled-mcpvault npx launcher and,
 * if so, proposes the current local and global replacements.
 *
 * Only an npx launcher whose package is `@bitbonsai/mcpvault` is ever judged.
 * Custom launchers are the user's and are left alone: the global `mcpvault`
 * (bare or by path), any other program, npx running another package, and npx
 * with `-p`/`--package` all return null. Reasons are checked in order: no
 * version, non-exact version, exact version older than the bundled pin, then no
 * auto-confirm before the spec. It never inspects which arg is the vault path:
 * `after.local` changes only the spec arg and the `-y` flag, and `after.global`
 * is every arg after the spec. Pure.
 */
export default function findLegacyLauncher(config: BrainAideMcpServerConfig): BrainLauncherOffer | null {
	const spec = readNpxPackageSpec(config);
	if (spec === null || spec.packageName !== MCPVAULT_PACKAGE) return null;

	const reasons: LegacyLauncherReason[] = [];
	if (spec.version === null) reasons.push("unpinned");
	else if (!EXACT_VERSION.test(spec.version)) reasons.push("unversioned");
	else if (isOlderVersion(spec.version, MCPVAULT_VERSION)) reasons.push("older-pin");
	if (!spec.autoConfirm) reasons.push("missing-auto-confirm");
	if (reasons.length === 0) return null;

	const needsPin = reasons.some((reason) => reason !== "missing-auto-confirm");
	const args = [...config.args];
	if (needsPin) args[spec.specIndex] = `${MCPVAULT_PACKAGE}@${MCPVAULT_VERSION}`;
	if (!spec.autoConfirm) args.splice(spec.specIndex, 0, "-y");

	return {
		reasons,
		before: config,
		after: {
			local: { command: config.command, args },
			global: { command: MCPVAULT_COMMAND, args: config.args.slice(spec.specIndex + 1) },
		},
	};
}
