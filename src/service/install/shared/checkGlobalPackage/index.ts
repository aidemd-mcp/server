import { exec } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Reports whether an npm package is installed globally: `npm root -g` gives the
 * global root, and the package counts as installed iff
 * `<root>/<packageName>/package.json` is accessible.
 *
 * Deliberate exception to "services throw": every failure (npm missing, the
 * command timing out, empty output, a missing package) resolves `false`. A
 * missing npm is the same answer as "not installed", and the consumer then
 * offers the install. Never installs anything and never throws.
 */
export default async function checkGlobalPackage(packageName: string): Promise<boolean> {
	try {
		const { stdout } = await execAsync("npm root -g", { timeout: 10000 });
		const root = stdout.trim();
		if (root === "") return false;
		await access(join(root, packageName, "package.json"));
		return true;
	} catch {
		return false;
	}
}
