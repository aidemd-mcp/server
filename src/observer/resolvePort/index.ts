import protocol from "@/service/observer/event/shared/protocol/index.js";
import parsePort from "../shared/parsePort/index.js";
import type { PortChoice } from "../types/index.js";

/**
 * Chooses the port the observer binds, in the one precedence every caller shares (brief
 * commitments #39, #44): the `--port` flag, else the `AIDE_OBSERVER_PORT` environment variable
 * when set and not blank, else the built-in default. An invalid value from the winning source
 * refuses the choice; it never falls through to the next source, and a valid flag means the
 * environment is not read at all.
 */
export default function resolvePort({
	flagPort,
	env = process.env,
}: {
	flagPort?: number;
	env?: NodeJS.ProcessEnv;
}): PortChoice {
	if (flagPort !== undefined) {
		const parsed = parsePort({ value: String(flagPort), source: "--port", shown: String(flagPort) });
		return parsed.ok ? { ok: true, port: parsed.port, source: "flag" } : parsed;
	}

	const raw = env[protocol.portEnvVar];
	if (raw === undefined || raw.trim() === "") {
		return { ok: true, port: protocol.defaultPort, source: "default" };
	}

	const parsed = parsePort({ value: raw, source: protocol.portEnvVar, shown: `"${raw}"` });
	return parsed.ok ? { ok: true, port: parsed.port, source: "env" } : parsed;
}
