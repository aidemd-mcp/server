import { access } from "node:fs/promises";
import { join } from "node:path";
import wireMcp from "@/service/install/wireMcp/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import type { LaunchMode } from "@/types/index.js";
import askLaunchMode from "./askLaunchMode/index.js";
import confirmGlobalInstall from "./confirmGlobalInstall/index.js";
import installGlobalPackage from "./installGlobalPackage/index.js";

/**
 * Resolves the launch mode for the aide and brain MCP servers before init plans
 * anything.
 *
 * Asks only for servers whose artifact would be created, so an existing choice
 * is never re-asked or switched: aide is needed when `.mcp.json` has no `aide`
 * or `aidemd-mcp` entry, the brain when `.aide/config/brain.aide` is absent. A
 * server that is not needed resolves `"local"`; its consumer keeps the existing
 * artifact anyway. A needed server takes the `--mode` flag when given, asks in
 * a terminal, and otherwise defaults to local.
 *
 * A global aide choice is verified against the global package. When it is
 * missing, the install runs only on the user's explicit OK; a decline, a failed
 * install, or no terminal to ask falls back to local with one line on `write`.
 * No package check runs for the brain: its install offer happens in
 * `/aide:brain config` before wiring.
 */
export default async function resolveLaunchModes(
	cwd: string,
	flagMode: LaunchMode | undefined,
	write: (line: string) => void,
): Promise<{ aide: LaunchMode; brain: LaunchMode }> {
	// Step 1: interactive means both streams are a terminal.
	const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

	// Step 2: aide is needed when no aide entry exists in .mcp.json.
	const aideStep = await wireMcp(join(cwd, ".mcp.json"));
	const aideNeeded = aideStep.status !== "exists";

	// Step 3: the brain is needed when its config marker is absent.
	const brainNeeded = !(await access(join(cwd, ".aide", "config", "brain.aide")).then(
		() => true,
		() => false,
	));

	// Step 4: flag wins, then the prompt, then local when unable to ask.
	let aide: LaunchMode = "local";
	if (aideNeeded) {
		aide = flagMode ?? (interactive ? await askLaunchMode("aide") : "local");
	}
	let brain: LaunchMode = "local";
	if (brainNeeded) {
		brain = flagMode ?? (interactive ? await askLaunchMode("brain") : "local");
	}

	// Step 5: a global aide choice needs the package; fall back to local otherwise.
	if (aide === "global" && !(await checkGlobalPackage(aidePackage.name))) {
		if (!interactive) {
			write(
				`aide MCP server: ${aidePackage.name} is not installed globally and there is no terminal to ask — using local launch (npx).`,
			);
			aide = "local";
		} else if (!(await confirmGlobalInstall(aidePackage.name, aidePackage.installCommand))) {
			write("aide MCP server: global install declined — using local launch (npx).");
			aide = "local";
		} else if (!(await installGlobalPackage(aidePackage.installCommand))) {
			write("aide MCP server: global install failed — using local launch (npx).");
			aide = "local";
		}
	}

	// Step 6
	return { aide, brain };
}
