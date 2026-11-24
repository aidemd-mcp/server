import { resolve } from "node:path";
import parsePort from "@/observer/shared/parsePort/index.js";
import type { ViewArgs } from "../types/index.js";

/**
 * Turns the arguments after `view` into a typed request. Pure: `--help` anywhere wins; `--port <n>`
 * is optional (absent, the run carries no port and the caller resolves it) and must be an integer in
 * 1-65535 when given; `--brain <path>` is optional and resolved against `cwd`. A repeated flag, a flag without a value or any other argument is `invalid` and names the
 * offending argument. Only the space-separated forms are accepted.
 */
export default function parseViewArgs({ args, cwd }: { args: string[]; cwd: string }): ViewArgs {
	if (args.includes("--help")) return { kind: "help" };

	let port: number | undefined;
	let brainPath: string | undefined;

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg !== "--port" && arg !== "--brain") {
			return { kind: "invalid", message: `Unknown argument "${arg}".` };
		}

		const value = args[index + 1];
		if (value === undefined) return { kind: "invalid", message: `${arg} needs a value.` };
		index++;

		if (arg === "--port") {
			if (port !== undefined) return { kind: "invalid", message: "--port was given more than once." };
			const parsed = parsePort({ value, source: "--port", shown: `"${value}"` });
			if (!parsed.ok) return { kind: "invalid", message: parsed.reason };
			port = parsed.port;
			continue;
		}

		if (brainPath !== undefined) return { kind: "invalid", message: "--brain was given more than once." };
		brainPath = resolve(cwd, value);
	}

	return { kind: "run", ...(port === undefined ? {} : { port }), ...(brainPath === undefined ? {} : { brainPath }) };
}
