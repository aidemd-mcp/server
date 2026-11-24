import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Answers whether the file `moduleUrl` names is the script Node was started
 * with, so a module can act as an entry point when run directly and stay a
 * plain import otherwise. Both paths go through `realpathSync` (package
 * installs can reach a file through a symlink or junction); on Windows the
 * comparison ignores case. Never throws: any failure answers false.
 */
export default function isMainModule({
	moduleUrl,
	entryPath,
}: {
	moduleUrl: string;
	entryPath: string | undefined;
}): boolean {
	try {
		// No entry script (REPL, eval): nothing to match
		if (!entryPath) return false;

		const moduleFile = realpathSync(fileURLToPath(moduleUrl));
		// A relative entry resolves against the working directory, as Node does
		const entryFile = realpathSync(resolve(entryPath));

		// Windows paths are case-insensitive
		if (process.platform === "win32") return moduleFile.toLowerCase() === entryFile.toLowerCase();
		return moduleFile === entryFile;
	} catch {
		return false;
	}
}
