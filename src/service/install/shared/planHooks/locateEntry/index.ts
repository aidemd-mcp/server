import { exec } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import aidePackage from "../../aidePackage/index.js";

const execAsync = promisify(exec);

/**
 * Locates this machine's globally installed AIDE entry point: `npm root -g`
 * gives the global root, `<root>/<package>/package.json`'s `bin` names the
 * entry (a string, or the record's `bin[command]`), and the joined path must
 * exist. Resolves the absolute path with every `\` turned into `/`, ready to sit
 * inside `node "<entry>" hook`.
 *
 * Deliberate exception to "services throw", like checkGlobalPackage: every
 * failure (npm missing, a timeout, an empty root, no package, no bin, a missing
 * file) resolves `null`, because "cannot locate" is the same answer as "not
 * installed" and the consumer then offers the install. A path containing a `"`
 * also resolves `null`, since it could not be quoted safely. Never installs
 * anything and never throws.
 */
export default async function locateEntry(): Promise<string | null> {
	try {
		const { stdout } = await execAsync("npm root -g", { timeout: 10000 });
		const root = stdout.trim();
		if (root === "") return null;

		const packageDir = join(root, aidePackage.name);
		const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf-8")) as {
			bin?: string | Record<string, string>;
		};
		const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[aidePackage.command];
		if (typeof bin !== "string" || bin === "") return null;

		const entry = join(packageDir, bin);
		await access(entry);

		const normalized = entry.replace(/\\/g, "/");
		return normalized.includes('"') ? null : normalized;
	} catch {
		return null;
	}
}
