import { join } from "node:path";
import wireMcp from "@/service/install/wireMcp/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import installGlobalPackage from "./installGlobalPackage/index.js";

/**
 * Installs the aide server globally when init is about to create the `aide`
 * entry and the package is missing, so the bare-command entry it writes can
 * start. Runs before anything else is written: a failed install throws and the
 * project is left exactly as it was.
 *
 * Skips the install, silently, when the entry already exists (init never touches
 * an existing entry; upgrade owns switching it), when `.mcp.json` is malformed
 * (`writeMcpEntry` aborts on it later, so installing first would be wasted), or
 * when the package is already installed.
 *
 * Running the installer is the consent to the global install: no prompt, no
 * flag, no terminal check.
 *
 * @param cwd - Project root holding `.mcp.json`.
 * @param write - Line-writer for the "Installing …" notice.
 * @throws Error when the install command fails.
 */
export default async function ensureGlobalAide(
	cwd: string,
	write: (line: string) => void,
): Promise<void> {
	const step = await wireMcp(join(cwd, ".mcp.json"));
	if (step.status === "exists") return;
	if (step.configMalformed) return;
	if (step.globalPackage?.installed) return;

	const { name, installCommand } = aidePackage;
	write(`Installing ${name} globally: ${installCommand}`);
	if (await installGlobalPackage(installCommand)) return;

	throw new Error(
		`${installCommand} failed, so ${name} is not installed globally. Nothing was written. Fix the install (for example, npm permissions or network) and run init again.`,
	);
}
