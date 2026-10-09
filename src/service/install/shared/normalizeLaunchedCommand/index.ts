/** The program an MCP entry launches, normalized for comparison. */
export type LaunchedCommand = { token: string; viaPath: boolean };

/** Matches a forward or back slash, i.e. a launcher token that carries a directory. */
const PATH_SEPARATOR = /[\\/]/;

/** Lowercases a raw launcher token, takes its basename and strips one `.cmd` or `.exe` suffix. */
function normalizeToken(raw: string): string {
	const basename = raw.split(PATH_SEPARATOR).pop() ?? "";
	return basename.toLowerCase().replace(/\.(cmd|exe)$/, "");
}

/**
 * One definition of "which program does this MCP entry launch", shared by mode
 * detection and upgrade's global canonical check. The launched token is `command`,
 * or `args[1]` when `command` normalizes to `cmd` and `args[0]` is `/c` (any case).
 * `viaPath` reports whether the raw token carried a directory separator. Pure; any
 * non-string or missing value yields null instead of throwing.
 */
export default function normalizeLaunchedCommand(entry: {
	command: unknown;
	args: unknown;
}): LaunchedCommand | null {
	if (typeof entry.command !== "string") return null;

	const commandToken = normalizeToken(entry.command);
	if (commandToken !== "cmd") {
		return {
			token: commandToken,
			viaPath: PATH_SEPARATOR.test(entry.command),
		};
	}

	if (!Array.isArray(entry.args)) return null;
	const [flag, launched] = entry.args;
	if (typeof flag !== "string" || flag.toLowerCase() !== "/c") return null;
	if (typeof launched !== "string") return null;

	return {
		token: normalizeToken(launched),
		viaPath: PATH_SEPARATOR.test(launched),
	};
}
