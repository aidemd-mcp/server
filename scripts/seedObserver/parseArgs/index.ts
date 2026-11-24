import type { FixtureSet } from "@/observer/seedFixtures/types/index.js";
import parsePort from "@/observer/shared/parsePort/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import refuse from "../refuse/index.js";
import parseSet from "./parseSet/index.js";

const QA_DEFAULT_PORT = 24799;

/** Reads `--port <n>` (default 24799), `--set` and `--empty`, refusing the real observer's port and anything that is not a port. */
export default function parseArgs({ args }: { args: string[] }): { port: number; empty: boolean; set: FixtureSet } {
	const portIndex = args.indexOf("--port");
	const raw = portIndex === -1 ? String(QA_DEFAULT_PORT) : (args[portIndex + 1] ?? "");
	const parsed = parsePort({ value: raw, source: "--port", shown: `"${raw}"` });

	if (!parsed.ok) refuse({ message: parsed.reason, code: 2 });
	if (parsed.port === protocol.defaultPort)
		refuse({ message: `Port ${parsed.port} is the real observer's port; the fixture observer never uses it.`, code: 2 });

	return { port: parsed.port, empty: args.includes("--empty"), set: parseSet({ args }) };
}
