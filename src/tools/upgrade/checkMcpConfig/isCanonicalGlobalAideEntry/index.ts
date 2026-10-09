import aidePackage from "@/service/install/shared/aidePackage/index.js";
import normalizeLaunchedCommand from "@/service/install/shared/normalizeLaunchedCommand/index.js";

/**
 * True iff the entry launches AIDE's global bin (`aidemd-mcp`) with no arguments
 * after the launched token: `args` is an empty array for a direct launch, or has
 * length exactly 2 (`/c` plus the token) for a `cmd /c` launch. A working
 * absolute-path shim is as valid as the bare name. Never throws.
 */
export default function isCanonicalGlobalAideEntry(entry: {
	command: unknown;
	args: unknown;
}): boolean {
	const launched = normalizeLaunchedCommand(entry);
	if (launched?.token !== aidePackage.command) return false;
	if (!Array.isArray(entry.args)) return false;

	const isCmdWrapper = typeof entry.command === "string" && /(^|[\\/])cmd(\.exe)?$/i.test(entry.command);
	return entry.args.length === (isCmdWrapper ? 2 : 0);
}
