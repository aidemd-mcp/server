const HOOK_EVENTS: ReadonlySet<string> = new Set(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"]);

const PACKAGE_NAME = "@aidemd-mcp/server";

/** Splits on unquoted whitespace; single and double quotes group and are stripped. */
function tokenize(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let started = false;
	let quote: string | null = null;
	for (const char of command) {
		if (quote !== null) {
			if (char === quote) quote = null;
			else current += char;
		} else if (char === "\"" || char === "'") {
			quote = char;
			started = true;
		} else if (/\s/.test(char)) {
			if (started) tokens.push(current);
			current = "";
			started = false;
		} else {
			current += char;
			started = true;
		}
	}
	if (started) tokens.push(current);
	return tokens;
}

/** The last path segment, lowercased, with one `.cmd`, `.exe` or `.ps1` suffix removed. */
function baseName(token: string): string {
	const segment = token.split(/[\\/]/).pop() ?? "";
	return segment.toLowerCase().replace(/\.(cmd|exe|ps1)$/, "");
}

/** The tokens before `hook`, or null when the command does not end in `hook` or `hook <EventName>`. */
function launchTokens(tokens: string[]): string[] | null {
	const last = tokens.length - 1;
	if (tokens[last] === "hook") return tokens.slice(0, last);
	if (tokens[last - 1] === "hook" && HOOK_EVENTS.has(tokens[last])) return tokens.slice(0, last - 1);
	return null;
}

/** Whether `spec` names the AIDE package, bare or with an `@version` suffix. */
const isPackageSpec = (spec: string): boolean => spec === PACKAGE_NAME || spec.startsWith(`${PACKAGE_NAME}@`);

/**
 * The single recognizer of an AIDE hook command, in any launch form, old or
 * current: a bare or path `aidemd-mcp[.cmd|.exe|.ps1]`, `npx [flags]
 * @aidemd-mcp/server[@version]`, or `node <path containing /@aidemd-mcp/server/>`,
 * the first two optionally behind `cmd /c`, then `hook` and optionally one hook
 * event name. Everything else, including a user's own `my-tool hook`, is not AIDE's.
 * Install, upgrade and boot all decide "is this entry AIDE's" here, so they cannot disagree.
 */
export default function isAideHookCommand(command: string): boolean {
	let tokens = tokenize(command.trim());
	if (/^cmd(\.exe)?$/i.test(tokens[0] ?? "") && tokens[1]?.toLowerCase() === "/c") tokens = tokens.slice(2);

	const launch = launchTokens(tokens);
	if (launch === null || launch.length === 0) return false;

	const [runner, ...args] = launch;
	switch (baseName(runner)) {
		case "aidemd-mcp":
			return args.length === 0;
		case "npx": {
			const firstSpec = args.findIndex((token) => !token.startsWith("-"));
			return firstSpec !== -1 && firstSpec === args.length - 1 && isPackageSpec(args[firstSpec]);
		}
		case "node":
			return args.length === 1 && args[0].replace(/\\/g, "/").toLowerCase().includes(`/${PACKAGE_NAME}/`);
		default:
			return false;
	}
}
