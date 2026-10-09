import { createInterface } from "node:readline/promises";
import launchModeChoices from "@/service/install/shared/launchModeChoices/index.js";
import type { LaunchMode } from "@/types/index.js";

const ATTEMPTS = 2;

/**
 * Asks which launch mode an MCP server should use, listing global (the
 * recommended default) and local with the approved one-line explanations. The
 * local wording differs per server because each pin is moved forward by a
 * different command. Empty or `1` picks global, `2` picks local; an
 * unrecognized answer re-asks once and then resolves global. Only called when
 * stdin and stdout are a terminal.
 */
export default async function askLaunchMode(server: "aide" | "brain"): Promise<LaunchMode> {
	const local = server === "brain" ? launchModeChoices.localBrain : launchModeChoices.local;
	process.stdout.write(
		`Launch mode for the ${server} MCP server:\n` +
			`  [1] ${launchModeChoices.global.label} — ${launchModeChoices.global.explanation}\n` +
			`  [2] ${local.label} — ${local.explanation}\n`,
	);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
			const answer = (await rl.question("Choose 1 or 2 [1]: ")).trim();
			if (answer === "" || answer === "1") return "global";
			if (answer === "2") return "local";
		}
		return "global";
	} finally {
		rl.close();
	}
}
