import type { LaunchMode } from "@/types/index.js";

const MISSING_VALUE = "--mode requires a value: global or local.";

/**
 * Parse `--mode <v>` or `--mode=<v>` from argv. One flag sets the launch mode
 * of both the aide and brain MCP servers. Returns `undefined` when the flag is
 * absent, which means "ask in a terminal, or local when unable to ask".
 *
 * Throws on a missing or empty value, and on any value other than
 * `global` or `local`.
 */
export default function parseMode(argv: readonly string[]): LaunchMode | undefined {
	const equalsForm = argv.find((a) => a.startsWith("--mode="));
	const value = equalsForm ? equalsForm.slice("--mode=".length).trim() : readSpaceForm(argv);
	if (value === undefined) return undefined;
	if (value.length === 0) throw new Error(MISSING_VALUE);
	if (value !== "global" && value !== "local") {
		throw new Error(`Unknown --mode value "${value}". Use global or local.`);
	}
	return value;
}

/** Reads the value after a bare `--mode`, or undefined when the flag is absent. */
function readSpaceForm(argv: readonly string[]): string | undefined {
	const idx = argv.indexOf("--mode");
	if (idx === -1) return undefined;
	if (idx + 1 >= argv.length || argv[idx + 1].startsWith("-")) throw new Error(MISSING_VALUE);
	return argv[idx + 1].trim();
}
