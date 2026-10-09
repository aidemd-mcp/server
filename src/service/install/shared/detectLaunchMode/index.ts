import normalizeLaunchedCommand from "../normalizeLaunchedCommand/index.js";
import type { LaunchMode } from "../../../../types/index.js";

/**
 * The one definition of local versus global, applied only to the aide entry.
 * An entry is local iff it launches `npx` (directly or through `cmd /c`),
 * whatever its version spec; everything else, including a malformed entry,
 * is global. Never throws.
 */
export default function detectLaunchMode(entry: {
	command: unknown;
	args: unknown;
}): LaunchMode {
	return normalizeLaunchedCommand(entry)?.token === "npx" ? "local" : "global";
}
